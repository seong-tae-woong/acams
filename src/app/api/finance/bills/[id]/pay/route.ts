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
};

const METHOD_TO_UI: Record<PrismaPM, string> = {
  [PrismaPM.CARD]: '카드',
  [PrismaPM.TRANSFER]: '계좌이체',
  [PrismaPM.CASH]: '현금',
};

// POST /api/finance/bills/[id]/pay
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '청구서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { amount, method, paidDate } = await req.json();

    if (!amount || !method || !paidDate) {
      return NextResponse.json({ error: '금액, 납부방법, 납부일은 필수입니다.' }, { status: 400 });
    }

    const prismaMethod = METHOD_TO_PRISMA[method];
    if (!prismaMethod) return NextResponse.json({ error: '유효하지 않은 납부방법입니다.' }, { status: 400 });

    const newPaid = existing.paidAmount + amount;
    const status = newPaid >= existing.amount ? PrismaBS.PAID : PrismaBS.PARTIAL;

    const updated = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          status,
          method: prismaMethod,
          paidDate: new Date(paidDate),
        },
        include: {
          student: { select: { name: true } },
          class: { select: { name: true } },
        },
      });

      // 영수증 자동 발행
      await tx.receipt.create({
        data: {
          billId: id,
          studentId: existing.studentId,
          amount,
          issuedDate: new Date(paidDate),
          method: prismaMethod,
          memo: '',
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
      dueDate: updated.dueDate.toISOString().slice(0, 10),
      paidDate: updated.paidDate?.toISOString().slice(0, 10) ?? null,
      method: updated.method ? METHOD_TO_UI[updated.method] : null,
      memo: updated.memo,
    });
  } catch (err) {
    console.error('[POST /api/finance/bills/[id]/pay]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
