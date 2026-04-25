import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const MAKEUP_INCLUDE = {
  originalClass: { select: { name: true } },
  teacher: { select: { name: true } },
  targets: { select: { studentId: true } },
} as const;

function mapMakeup(m: {
  id: string; originalClassId: string; originalDate: Date;
  makeupDate: Date; makeupTime: string; teacherId: string;
  reason: string; attendanceChecked: boolean;
  originalClass: { name: string };
  teacher: { name: string };
  targets: { studentId: string }[];
}) {
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
    reason: m.reason,
    attendanceChecked: m.attendanceChecked,
  };
}

// PATCH /api/makeup/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const existing = await prisma.makeupClass.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '보강 수업을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { makeupDate, makeupTime, teacherId, reason, attendanceChecked, targetStudents } = body;

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
        await tx.makeupClassTarget.deleteMany({ where: { makeupClassId: id } });
        if (targetStudents.length > 0) {
          await tx.makeupClassTarget.createMany({
            data: targetStudents.map((studentId: string) => ({ makeupClassId: id, studentId })),
            skipDuplicates: true,
          });
        }
      }
    });

    const updated = await prisma.makeupClass.findUnique({
      where: { id },
      include: MAKEUP_INCLUDE,
    });

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
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
