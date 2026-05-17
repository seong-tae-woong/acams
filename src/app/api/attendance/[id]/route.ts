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

const STATUS_TO_UI: Record<PrismaStatus, string> = {
  [PrismaStatus.PRESENT]: '출석',
  [PrismaStatus.ABSENT]: '결석',
  [PrismaStatus.LATE]: '지각',
  [PrismaStatus.EARLY_LEAVE]: '조퇴',
};

// PATCH /api/attendance/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const existing = await prisma.attendanceRecord.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '출결 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { status, memo, checkInTime, checkOutTime } = body;

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        ...(status !== undefined && STATUS_TO_PRISMA[status] && { status: STATUS_TO_PRISMA[status] }),
        ...(memo !== undefined && { memo }),
        ...(checkInTime !== undefined && { checkInTime }),
        ...(checkOutTime !== undefined && { checkOutTime }),
        checkedAt: new Date(),
      },
      include: {
        student: { select: { name: true } },
        class: { select: { name: true } },
        checkedBy: { select: { id: true } },
      },
    });

    // per-lesson 청구서 재계산
    const month = updated.date.toISOString().slice(0, 7);
    recalculateBillByContext(updated.studentId, updated.classId, month).catch(console.error);

    return NextResponse.json({
      id: updated.id,
      studentId: updated.studentId,
      studentName: updated.student.name,
      classId: updated.classId,
      className: updated.class.name,
      date: updated.date.toISOString().slice(0, 10),
      status: STATUS_TO_UI[updated.status],
      checkInTime: updated.checkInTime,
      checkOutTime: updated.checkOutTime,
      memo: updated.memo,
      checkedBy: updated.checkedBy?.id ?? 'system',
      checkedAt: updated.checkedAt.toISOString(),
    });
  } catch (err) {
    console.error('[PATCH /api/attendance/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
