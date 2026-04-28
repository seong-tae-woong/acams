import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// POST /api/mobile/payments/order
// 결제 주문 생성 — orderId(= PaymentOrder.id)를 토스페이먼츠에 전달하기 위해 사용
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId    = req.headers.get('x-user-id');
  const role      = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 학생 ID 확인
    let studentId: string | null = null;

    if (role === 'student') {
      const s = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true },
      });
      studentId = s?.id ?? null;
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: { student: { select: { id: true } } },
            take: 1,
          },
        },
      });
      studentId = parent?.children[0]?.student.id ?? null;
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { billIds, amount } = await req.json();

    if (!Array.isArray(billIds) || billIds.length === 0) {
      return NextResponse.json({ error: 'billIds는 필수입니다.' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '결제 금액이 올바르지 않습니다.' }, { status: 400 });
    }

    // 청구서가 이 학생의 것인지, 미납/부분납 상태인지 검증
    const bills = await prisma.bill.findMany({
      where: {
        id: { in: billIds },
        studentId,
        academyId,
      },
    });

    if (bills.length !== billIds.length) {
      return NextResponse.json({ error: '유효하지 않은 청구서가 포함되어 있습니다.' }, { status: 400 });
    }

    const alreadyPaid = bills.filter((b) => b.status === 'PAID');
    if (alreadyPaid.length > 0) {
      return NextResponse.json({ error: '이미 완납된 청구서가 포함되어 있습니다.' }, { status: 400 });
    }

    // 실제 납부해야 할 총액 계산 (기납부액 제외)
    const expectedTotal = bills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
    if (amount !== expectedTotal) {
      return NextResponse.json(
        { error: `결제 금액이 청구 잔액(${expectedTotal.toLocaleString()}원)과 다릅니다.` },
        { status: 400 },
      );
    }

    // PaymentOrder 생성 — id 가 토스 orderId로 사용됨
    const order = await prisma.paymentOrder.create({
      data: {
        academyId,
        studentId,
        billIds,
        amount,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ orderId: order.id, amount: order.amount });
  } catch (err) {
    console.error('[POST /api/mobile/payments/order]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
