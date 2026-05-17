import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS, PaymentMethod as PrismaPM } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';

const BILL_STATUS_TO_UI: Record<PrismaBS, string> = {
  [PrismaBS.PAID]: '완납',
  [PrismaBS.UNPAID]: '미납',
  [PrismaBS.PARTIAL]: '부분납',
  [PrismaBS.CANCELLED]: '취소됨',
};

const METHOD_TO_UI: Record<PrismaPM, string> = {
  [PrismaPM.CARD]: '카드',
  [PrismaPM.TRANSFER]: '계좌이체',
  [PrismaPM.CASH]: '현금',
};

function toKSTDate(d: Date): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(d);
}

// PATCH /api/finance/bills/[id]/adjust — body: { adjustAmount, adjustMemo }
// 청구액 조정값을 갱신하고 조정 이력(BillAdjustment) 1건을 기록
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const userName = decodeURIComponent(req.headers.get('x-user-name') ?? '');
  const { id } = await ctx.params;

  try {
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '청구서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (existing.status === PrismaBS.CANCELLED) {
      return NextResponse.json({ error: '취소된 청구서는 조정할 수 없습니다.' }, { status: 400 });
    }

    const { adjustAmount, adjustMemo } = await req.json();
    if (typeof adjustAmount !== 'number' || adjustAmount < 0) {
      return NextResponse.json({ error: '차감 금액은 0 이상이어야 합니다.' }, { status: 400 });
    }
    if (adjustAmount >= existing.amount) {
      return NextResponse.json({ error: '차감 금액이 청구액 이상일 수 없습니다.' }, { status: 400 });
    }

    // 조정 후 실청구액 기준으로 납부 상태 재계산
    const effectiveAmount = existing.amount - adjustAmount;
    let status: PrismaBS;
    if (existing.paidAmount >= effectiveAmount && effectiveAmount > 0) status = PrismaBS.PAID;
    else if (existing.paidAmount > 0) status = PrismaBS.PARTIAL;
    else status = PrismaBS.UNPAID;

    const memo = typeof adjustMemo === 'string' ? adjustMemo : '';

    const updated = await prisma.$transaction(async (tx) => {
      await tx.billAdjustment.create({
        data: { billId: id, amount: adjustAmount, memo, createdByName: userName },
      });
      return tx.bill.update({
        where: { id },
        data: { adjustAmount, adjustMemo: memo, status },
        include: {
          student: { select: { name: true } },
          class: { select: { name: true, feeType: true } },
          _count: { select: { adjustments: true } },
        },
      });
    });

    return NextResponse.json({
      id: updated.id,
      studentId: updated.studentId,
      studentName: updated.student.name,
      classId: updated.classId,
      className: updated.class.name,
      month: updated.month,
      amount: updated.amount,
      paidAmount: updated.paidAmount,
      status: BILL_STATUS_TO_UI[updated.status],
      dueDate: toKSTDate(updated.dueDate),
      paidDate: updated.paidDate ? toKSTDate(updated.paidDate) : null,
      method: updated.method ? METHOD_TO_UI[updated.method] : null,
      memo: updated.memo,
      adjustAmount: updated.adjustAmount,
      adjustMemo: updated.adjustMemo,
      adjustCount: updated._count.adjustments,
      feeType: updated.class.feeType,
      scheduledCount: updated.scheduledCount,
      absentCount: updated.absentCount,
      makeupCount: updated.makeupCount,
      notifiedAt: updated.notifiedAt?.toISOString() ?? null,
      cancelledAt: updated.cancelledAt?.toISOString() ?? null,
      cancelReason: updated.cancelReason,
      paymentOrderId: updated.paymentOrderId,
      rebillOfId: updated.rebillOfId,
    });
  } catch (err) {
    console.error('[PATCH /api/finance/bills/[id]/adjust]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
