import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS, PaymentMethod as PrismaPM } from '@/generated/prisma/client';
import { calcInitialPerLessonAmount } from '@/lib/utils/billing';

// 한국 표준시(KST) 기준 날짜 문자열 반환 — 결제 시각 등 시간 정보가 있는 Date를 올바르게 표시
function toKSTDate(d: Date): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(d);
}

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

function mapBill(b: {
  id: string; studentId: string; classId: string;
  month: string; amount: number; paidAmount: number;
  status: PrismaBS; dueDate: Date; paidDate: Date | null;
  method: PrismaPM | null; memo: string;
  scheduledCount: number | null; absentCount: number | null; makeupCount: number | null;
  notifiedAt: Date | null;
  cancelledAt: Date | null; cancelReason: string | null;
  paymentOrderId: string | null; rebillOfId: string | null;
  student: { name: string };
  class: { name: string; feeType: string };
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
    dueDate: toKSTDate(b.dueDate),
    paidDate: b.paidDate ? toKSTDate(b.paidDate) : null,
    method: b.method ? METHOD_TO_UI[b.method] : null,
    memo: b.memo,
    feeType: b.class.feeType,
    scheduledCount: b.scheduledCount,
    absentCount: b.absentCount,
    makeupCount: b.makeupCount,
    notifiedAt: b.notifiedAt?.toISOString() ?? null,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    cancelReason: b.cancelReason,
    paymentOrderId: b.paymentOrderId,
    rebillOfId: b.rebillOfId,
  };
}

const BILL_INCLUDE = {
  student: { select: { name: true } },
  class: { select: { name: true, feeType: true } },
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
    '완납': PrismaBS.PAID, '미납': PrismaBS.UNPAID, '부분납': PrismaBS.PARTIAL, '취소됨': PrismaBS.CANCELLED,
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
    console.error('[GET /api/finance/bills]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/finance/bills
// body: { studentId, classId, month, dueDate, memo? }
// per-lesson 수업은 출결·보강 기반으로 amount 자동 계산
// monthly/weekly 수업은 body.amount 사용
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { studentId, classId, month, dueDate, memo, amount: bodyAmount } = body;

    if (!studentId || !classId || !month || !dueDate) {
      return NextResponse.json({ error: 'studentId, classId, month, dueDate는 필수입니다.' }, { status: 400 });
    }

    // 중복 방지 — CANCELLED 제외한 활성 청구서만 체크
    const existing = await prisma.bill.findFirst({
      where: { studentId, classId, month, status: { not: PrismaBS.CANCELLED } },
    });
    if (existing) {
      return NextResponse.json({ error: '해당 월 청구서가 이미 존재합니다.' }, { status: 409 });
    }

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { academyId: true, feeType: true, fee: true },
    });
    if (!cls || cls.academyId !== academyId) {
      return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });
    }

    let amount: number;
    let scheduledCount: number | null = null;

    if (cls.feeType === 'per-lesson') {
      const calc = await calcInitialPerLessonAmount(classId, month);
      amount = calc.amount;
      scheduledCount = calc.scheduledCount;
    } else {
      amount = typeof bodyAmount === 'number' ? bodyAmount : cls.fee;
    }

    const bill = await prisma.bill.create({
      data: {
        academyId,
        studentId,
        classId,
        month,
        amount,
        paidAmount: 0,
        status: PrismaBS.UNPAID,
        dueDate: new Date(dueDate),
        memo: memo ?? '',
        scheduledCount,
      },
      include: BILL_INCLUDE,
    });

    return NextResponse.json(mapBill(bill), { status: 201 });
  } catch (err) {
    console.error('[POST /api/finance/bills]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
