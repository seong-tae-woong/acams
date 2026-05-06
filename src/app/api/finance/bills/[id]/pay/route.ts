import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS, PaymentMethod as PrismaPM } from '@/generated/prisma/client';

const METHOD_TO_PRISMA: Record<string, PrismaPM> = {
  '카드': PrismaPM.CARD,
  '계좌이체': PrismaPM.TRANSFER,
  '현금': PrismaPM.CASH,
};

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

// POST /api/finance/bills/[id]/pay
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  const userId    = req.headers.get('x-user-id') ?? '';
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '청구서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (existing.status === PrismaBS.PAID) {
      return NextResponse.json({ error: '이미 완납된 청구서입니다.' }, { status: 409 });
    }
    if (existing.status === PrismaBS.CANCELLED) {
      return NextResponse.json({ error: '취소된 청구서는 수납할 수 없습니다.' }, { status: 400 });
    }

    const { amount, method, paidDate } = await req.json();

    if (!amount || !method || !paidDate) {
      return NextResponse.json({ error: '금액, 납부방법, 납부일은 필수입니다.' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: '수납 금액은 0보다 커야 합니다.' }, { status: 400 });
    }

    // 잔여 금액 초과 검증 — receipt가 bill.amount를 초과하지 못하도록 보장
    const remaining = existing.amount - existing.paidAmount;
    if (amount > remaining) {
      return NextResponse.json(
        { error: `수납 금액(${amount.toLocaleString()}원)이 잔여 금액(${remaining.toLocaleString()}원)을 초과합니다.` },
        { status: 400 },
      );
    }

    const prismaMethod = METHOD_TO_PRISMA[method];
    if (!prismaMethod) return NextResponse.json({ error: '유효하지 않은 납부방법입니다.' }, { status: 400 });

    const newPaid = existing.paidAmount + amount;
    const status  = newPaid >= existing.amount ? PrismaBS.PAID : PrismaBS.PARTIAL;
    const paidDateObj = new Date(paidDate);

    const updated = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          status,
          method: prismaMethod,
          paidDate: paidDateObj,
        },
        include: {
          student: { select: { name: true } },
          class: { select: { name: true, feeType: true } },
        },
      });

      // 수납 처리자(userId)를 paidBy에 기록해 감사 추적 가능하게 함
      await tx.receipt.create({
        data: {
          billId: id,
          studentId: existing.studentId,
          amount,
          issuedDate: paidDateObj,
          method: prismaMethod,
          memo: '',
          paidBy: userId,
        },
      });

      return bill;
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
      feeType: updated.class.feeType,
      notifiedAt: null,
    });
  } catch (err) {
    console.error('[POST /api/finance/bills/[id]/pay]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
