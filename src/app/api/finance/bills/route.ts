import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS, PaymentMethod as PrismaPM } from '@/generated/prisma/client';

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

function mapBill(b: {
  id: string; studentId: string; classId: string;
  month: string; amount: number; paidAmount: number;
  status: PrismaBS; dueDate: Date; paidDate: Date | null;
  method: PrismaPM | null; memo: string;
  student: { name: string };
  class: { name: string };
}) {
  return {
    id: b.id,
    studentId: b.studentId,
    studentName: b.student.name,
    classId: b.classId,
    className: b.class.name,
    month: b.month,
    amount: b.amount,
    paidAmount: b.paidAmount,
    status: BILL_STATUS_TO_UI[b.status],
    dueDate: b.dueDate.toISOString().slice(0, 10),
    paidDate: b.paidDate?.toISOString().slice(0, 10) ?? null,
    method: b.method ? METHOD_TO_UI[b.method] : null,
    memo: b.memo,
  };
}

const BILL_INCLUDE = {
  student: { select: { name: true } },
  class: { select: { name: true } },
} as const;

// GET /api/finance/bills?month=&studentId=&status=
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const paidMonth = searchParams.get('paidMonth');
  const studentId = searchParams.get('studentId');
  const statusStr = searchParams.get('status');

  const STATUS_MAP: Record<string, PrismaBS> = {
    '완납': PrismaBS.PAID, '미납': PrismaBS.UNPAID, '부분납': PrismaBS.PARTIAL,
  };

  const paidMonthFilter = paidMonth
    ? {
        paidDate: {
          gte: new Date(`${paidMonth}-01`),
          lt: new Date(`${paidMonth.slice(0, 4)}-${String(parseInt(paidMonth.slice(5, 7)) + 1).padStart(2, '0')}-01`),
        },
      }
    : {};

  try {
    const bills = await prisma.bill.findMany({
      where: {
        academyId,
        ...(month ? { month } : {}),
        ...paidMonthFilter,
        ...(studentId ? { studentId } : {}),
        ...(statusStr && STATUS_MAP[statusStr] ? { status: STATUS_MAP[statusStr] } : {}),
      },
      include: BILL_INCLUDE,
      orderBy: [{ month: 'desc' }, { student: { name: 'asc' } }],
    });

    return NextResponse.json(bills.map(mapBill));
  } catch (err) {
    console.error('[GET /api/finance/bills]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
