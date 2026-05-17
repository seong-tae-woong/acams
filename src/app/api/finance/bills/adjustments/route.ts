import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/finance/bills/adjustments?studentId= — 해당 학생의 청구액 조정 이력
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const studentId = new URL(req.url).searchParams.get('studentId');
  if (!studentId) {
    return NextResponse.json({ error: 'studentId는 필수입니다.' }, { status: 400 });
  }

  try {
    const adjustments = await prisma.billAdjustment.findMany({
      where: { bill: { academyId, studentId } },
      include: { bill: { select: { month: true, class: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      adjustments.map((a) => ({
        id: a.id,
        billId: a.billId,
        month: a.bill.month,
        className: a.bill.class.name,
        amount: a.amount,
        memo: a.memo,
        createdByName: a.createdByName,
        createdAt: a.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    console.error('[GET /api/finance/bills/adjustments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
