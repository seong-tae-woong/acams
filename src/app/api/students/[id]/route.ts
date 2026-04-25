import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { StudentStatus as PrismaStatus } from '@/generated/prisma/client';

const STATUS_TO_PRISMA: Record<string, PrismaStatus> = {
  '재원': PrismaStatus.ACTIVE,
  '휴원': PrismaStatus.ON_LEAVE,
  '퇴원': PrismaStatus.WITHDRAWN,
  '대기': PrismaStatus.WAITING,
};

const STATUS_TO_UI: Record<PrismaStatus, string> = {
  [PrismaStatus.ACTIVE]: '재원',
  [PrismaStatus.ON_LEAVE]: '휴원',
  [PrismaStatus.WITHDRAWN]: '퇴원',
  [PrismaStatus.WAITING]: '대기',
};

const STUDENT_INCLUDE = {
  parentLinks: { include: { parent: { select: { name: true, phone: true } } } },
  classEnrollments: { select: { classId: true, isActive: true } },
  siblingLinks: { select: { studentBId: true } },
  siblingOf: { select: { studentAId: true } },
} as const;

function mapStudent(s: {
  id: string; name: string; school: string; grade: number;
  phone: string | null; status: PrismaStatus; enrollDate: Date;
  memo: string; avatarColor: string; attendanceNumber: string;
  qrCode: string; birthDate: Date | null;
  parentLinks: { parent: { name: string; phone: string } }[];
  classEnrollments: { classId: string; isActive: boolean }[];
  siblingLinks: { studentBId: string }[];
  siblingOf: { studentAId: string }[];
}) {
  return {
    id: s.id,
    name: s.name,
    school: s.school,
    grade: s.grade,
    phone: s.phone ?? '',
    parentName: s.parentLinks[0]?.parent.name ?? '',
    parentPhone: s.parentLinks[0]?.parent.phone ?? '',
    status: STATUS_TO_UI[s.status],
    enrollDate: s.enrollDate.toISOString().slice(0, 10),
    classes: s.classEnrollments.filter((e) => e.isActive).map((e) => e.classId),
    siblingIds: [
      ...s.siblingLinks.map((sl) => sl.studentBId),
      ...s.siblingOf.map((sl) => sl.studentAId),
    ],
    memo: s.memo,
    avatarColor: s.avatarColor,
    attendanceNumber: s.attendanceNumber,
    qrCode: s.qrCode,
    birthDate: s.birthDate?.toISOString().slice(0, 10) ?? undefined,
  };
}

// GET /api/students/[id]
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: STUDENT_INCLUDE,
    });

    if (!student || student.academyId !== academyId) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(mapStudent(student));
  } catch (err) {
    console.error('[GET /api/students/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/students/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { name, school, grade, phone, status, memo, avatarColor, attendanceNumber, birthDate, classes } = body;

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(school !== undefined && { school }),
          ...(grade !== undefined && { grade }),
          ...(phone !== undefined && { phone: phone || null }),
          ...(status !== undefined && STATUS_TO_PRISMA[status] && { status: STATUS_TO_PRISMA[status] }),
          ...(memo !== undefined && { memo }),
          ...(avatarColor !== undefined && { avatarColor }),
          ...(attendanceNumber !== undefined && { attendanceNumber }),
          ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
        },
      });

      // classes 배열이 전달되면 enrollment 갱신
      if (Array.isArray(classes)) {
        // 현재 enrollments
        const current = await tx.classEnrollment.findMany({
          where: { studentId: id, isActive: true },
        });
        const currentIds = current.map((e) => e.classId);
        const toAdd = classes.filter((cId: string) => !currentIds.includes(cId));
        const toDrop = currentIds.filter((cId) => !classes.includes(cId));

        for (const classId of toAdd) {
          await tx.classEnrollment.upsert({
            where: { classId_studentId: { classId, studentId: id } },
            update: { isActive: true, droppedAt: null },
            create: { classId, studentId: id, isActive: true },
          });
        }
        for (const classId of toDrop) {
          await tx.classEnrollment.update({
            where: { classId_studentId: { classId, studentId: id } },
            data: { isActive: false, droppedAt: new Date() },
          });
        }
      }
    });

    const updated = await prisma.student.findUnique({
      where: { id },
      include: STUDENT_INCLUDE,
    });

    return NextResponse.json(mapStudent(updated!));
  } catch (err) {
    console.error('[PATCH /api/students/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
