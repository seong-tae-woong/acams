import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { AttendanceStatus as PrismaStatus } from '@/generated/prisma/client';
import { recalculateBillByContext } from '@/lib/utils/billing';
import { requireAuth } from '@/lib/auth/requireAuth';

const STATUS_TO_PRISMA: Record<string, PrismaStatus> = {
  '출석': PrismaStatus.PRESENT,
  '결석': PrismaStatus.ABSENT,
  '지각': PrismaStatus.LATE,
  '조퇴': PrismaStatus.EARLY_LEAVE,
};

const STATUS_TO_UI: Record<PrismaStatus, '출석' | '결석' | '지각' | '조퇴'> = {
  [PrismaStatus.PRESENT]: '출석',
  [PrismaStatus.ABSENT]: '결석',
  [PrismaStatus.LATE]: '지각',
  [PrismaStatus.EARLY_LEAVE]: '조퇴',
};

const MAKEUP_INCLUDE = {
  originalClass: { select: { name: true } },
  teacher: { select: { name: true } },
  targets: { select: { studentId: true, status: true, memo: true } },
} as const;

type MakeupForMap = {
  id: string; originalClassId: string; originalDate: Date;
  makeupDate: Date; makeupTime: string; teacherId: string;
  reason: string; attendanceChecked: boolean;
  originalClass: { name: string };
  teacher: { name: string };
  targets: { studentId: string; status: PrismaStatus | null; memo: string }[];
};

function mapMakeup(m: MakeupForMap) {
  return {
    id: m.id,
    originalClassId: m.originalClassId,
    originalClassName: m.originalClass.name,
    originalDate: m.originalDate.toISOString().slice(0, 10),
    makeupDate: m.makeupDate.toISOString().slice(0, 10),
    makeupTime: m.makeupTime,
    teacherId: m.teacherId,
    teacherName: m.teacher.name,
    targetStudents: m.targets.map((t) => t.studentId),
    attendance: m.targets.map((t) => ({
      studentId: t.studentId,
      status: t.status ? STATUS_TO_UI[t.status] : null,
      memo: t.memo,
    })),
    reason: m.reason,
    attendanceChecked: m.attendanceChecked,
  };
}

// PATCH /api/makeup/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const existing = await prisma.makeupClass.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '보강 수업을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const {
      makeupDate, makeupTime, teacherId, reason,
      attendanceChecked, targetStudents, attendance,
    } = body;

    await prisma.$transaction(async (tx) => {
      await tx.makeupClass.update({
        where: { id },
        data: {
          ...(makeupDate && { makeupDate: new Date(makeupDate) }),
          ...(makeupTime !== undefined && { makeupTime }),
          ...(teacherId && { teacherId }),
          ...(reason !== undefined && { reason }),
          ...(attendanceChecked !== undefined && { attendanceChecked }),
        },
      });

      if (Array.isArray(targetStudents)) {
        const existingTargets = await tx.makeupClassTarget.findMany({
          where: { makeupClassId: id },
          select: { studentId: true },
        });
        const existingIds = new Set(existingTargets.map((t) => t.studentId));
        const nextIds = new Set(targetStudents as string[]);

        const toDelete = [...existingIds].filter((sid) => !nextIds.has(sid));
        const toAdd = [...nextIds].filter((sid) => !existingIds.has(sid));

        if (toDelete.length > 0) {
          await tx.makeupClassTarget.deleteMany({
            where: { makeupClassId: id, studentId: { in: toDelete } },
          });
        }
        if (toAdd.length > 0) {
          await tx.makeupClassTarget.createMany({
            data: toAdd.map((studentId) => ({ makeupClassId: id, studentId })),
            skipDuplicates: true,
          });
        }
      }

      // 학생별 출결 저장 (제공된 경우만)
      if (Array.isArray(attendance)) {
        for (const a of attendance as Array<{ studentId: string; status: string | null; memo?: string }>) {
          if (!a?.studentId) continue;
          const prismaStatus = a.status ? (STATUS_TO_PRISMA[a.status] ?? null) : null;
          await tx.makeupClassTarget.upsert({
            where: { makeupClassId_studentId: { makeupClassId: id, studentId: a.studentId } },
            update: {
              status: prismaStatus,
              memo: a.memo ?? '',
            },
            create: {
              makeupClassId: id,
              studentId: a.studentId,
              status: prismaStatus,
              memo: a.memo ?? '',
            },
          });
        }
      }
    });

    const updated = await prisma.makeupClass.findUnique({
      where: { id },
      include: MAKEUP_INCLUDE,
    });

    // attendanceChecked 변경 시 → 원본 수업 월의 per-lesson 청구서 재계산
    if (attendanceChecked !== undefined && updated) {
      const month = updated.originalDate.toISOString().slice(0, 7);
      await Promise.allSettled(
        updated.targets.map((t) =>
          recalculateBillByContext(t.studentId, updated.originalClassId, month)
        )
      );
    }

    return NextResponse.json(mapMakeup(updated!));
  } catch (err) {
    console.error('[PATCH /api/makeup/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/makeup/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const existing = await prisma.makeupClass.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '보강 수업을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.makeupClassTarget.deleteMany({ where: { makeupClassId: id } });
      await tx.makeupClass.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/makeup/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
