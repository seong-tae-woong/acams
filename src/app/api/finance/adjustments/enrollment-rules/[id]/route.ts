import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { calculateBillWithAdjustments } from '@/lib/utils/billing';

/**
 * DELETE /api/finance/adjustments/enrollment-rules/[id]
 * 원장 전용 — 수강 등록 규칙 삭제 후 활성 청구서 재계산
 */

async function recalcActiveBills(enrollmentId: string) {
  const enr = await prisma.classEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { studentId: true, classId: true },
  });
  if (!enr) return;

  const bills = await prisma.bill.findMany({
    where: {
      studentId: enr.studentId,
      classId: enr.classId,
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
    select: { id: true },
  });

  await Promise.all(bills.map((b) => calculateBillWithAdjustments(b.id)));
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const rule = await prisma.enrollmentRule.findUnique({
      where: { id },
      select: { academyId: true, enrollmentId: true },
    });

    if (!rule || rule.academyId !== academyId) {
      return NextResponse.json({ error: '규칙을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { enrollmentId } = rule;

    await prisma.enrollmentRule.delete({ where: { id } });

    // 삭제 후 활성 청구서 재계산
    await recalcActiveBills(enrollmentId);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[DELETE /api/finance/adjustments/enrollment-rules/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
