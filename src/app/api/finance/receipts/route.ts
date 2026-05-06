import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { PaymentMethod as PrismaPM } from '@/generated/prisma/client';

const METHOD_TO_UI: Record<PrismaPM, string> = {
  [PrismaPM.CARD]: '카드',
  [PrismaPM.TRANSFER]: '계좌이체',
  [PrismaPM.CASH]: '현금',
};

const METHOD_TO_PRISMA: Record<string, PrismaPM> = {
  '카드': PrismaPM.CARD,
  '계좌이체': PrismaPM.TRANSFER,
  '현금': PrismaPM.CASH,
};

function mapReceipt(r: {
  id: string; billId: string; studentId: string;
  amount: number; issuedDate: Date; method: PrismaPM; memo: string;
  cancelledAt: Date | null;
  bill: { student: { name: string } };
}) {
  return {
    id: r.id,
    billId: r.billId,
    studentId: r.studentId,
    studentName: r.bill.student.name,
    amount: r.amount,
    issuedDate: r.issuedDate.toISOString().slice(0, 10),
    method: METHOD_TO_UI[r.method],
    memo: r.memo,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  };
}

const RECEIPT_INCLUDE = {
  bill: { include: { student: { select: { name: true } } } },
} as const;

// GET /api/finance/receipts?month=YYYY-MM&studentId=
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const studentId = searchParams.get('studentId');

  try {
    const receipts = await prisma.receipt.findMany({
      where: {
        bill: { academyId },
        ...(studentId ? { studentId } : {}),
        ...(month
          ? {
              issuedDate: {
                gte: new Date(`${month}-01`),
                lt: new Date(
                  month.slice(0, 4) + '-' +
                  String(parseInt(month.slice(5, 7)) + 1).padStart(2, '0') + '-01'
                ),
              },
            }
          : {}),
      },
      include: RECEIPT_INCLUDE,
      orderBy: { issuedDate: 'desc' },
    });

    return NextResponse.json(receipts.map(mapReceipt));
  } catch (err) {
    console.error('[GET /api/finance/receipts]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/finance/receipts — 수동 영수증 발행
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { billId, amount, issuedDate, method, memo } = await req.json();

    if (!billId || !amount || !issuedDate || !method) {
      return NextResponse.json({ error: '청구서, 금액, 발행일, 납부방법은 필수입니다.' }, { status: 400 });
    }

    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill || bill.academyId !== academyId) {
      return NextResponse.json({ error: '청구서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const prismaMethod = METHOD_TO_PRISMA[method];
    if (!prismaMethod) return NextResponse.json({ error: '유효하지 않은 납부방법입니다.' }, { status: 400 });

    const receipt = await prisma.receipt.create({
      data: {
        billId,
        studentId: bill.studentId,
        amount,
        issuedDate: new Date(issuedDate),
        method: prismaMethod,
        memo: memo ?? '',
      },
      include: RECEIPT_INCLUDE,
    });

    return NextResponse.json(mapReceipt(receipt), { status: 201 });
  } catch (err) {
    console.error('[POST /api/finance/receipts]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
