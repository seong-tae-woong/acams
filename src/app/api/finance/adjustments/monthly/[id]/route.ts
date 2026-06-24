import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { calculateBillWithAdjustments } from '@/lib/utils/billing';

/**
 * DELETE /api/finance/adjustments/monthly/[id]
 * 원장 전용 — 월별 조정 삭제 후 해당 월 활성 청구서 재계산
 */

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
    const adj = await prisma.monthlyAdjustment.findUnique({
      where: { id },
      select: {
        academyId: true,
        billingMonth: true,
        scope: true,
        classId: true,
        studentId: true,
      },
    });

    if (!adj || adj.academyId !== academyId) {
      return NextResponse.json({ error: '조정 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.monthlyAdjustment.delete({ where: { id } });

    // 삭제 후 해당 월 활성 청구서 재계산
    const bills = await prisma.bill.findMany({
      where: {
        academyId,
        month: adj.billingMonth,
        status: { notIn: ['PAID', 'CANCELLED'] },
        ...(adj.scope === 'class' && adj.classId ? { classId: adj.classId } : {}),
        ...(adj.scope === 'student' && adj.studentId ? { studentId: adj.studentId } : {}),
      },
      select: { id: true },
    });

    await Promise.all(bills.map((b) => calculateBillWithAdjustments(b.id)));

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[DELETE /api/finance/adjustments/monthly/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
