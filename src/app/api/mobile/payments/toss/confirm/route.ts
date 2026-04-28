import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS, PaymentMethod as PrismaPM } from '@/generated/prisma/client';

// POST /api/mobile/payments/toss/confirm
// 토스페이먼츠 결제 승인 → 청구서 상태 업데이트 + 영수증 발행
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId    = req.headers.get('x-user-id');
  const role      = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { paymentKey, orderId, amount } = await req.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: 'paymentKey, orderId, amount는 필수입니다.' }, { status: 400 });
    }

    // PaymentOrder 조회
    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order || order.academyId !== academyId) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (order.status === 'PAID') {
      return NextResponse.json({ error: '이미 완료된 결제입니다.' }, { status: 409 });
    }
    if (order.amount !== amount) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    // 학생 본인 확인
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
    }

    if (!studentId || studentId !== order.studentId) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // ── 토스페이먼츠 승인 API 호출 ──────────────────────────
    const secretKey = process.env.TOSS_SECRET_KEY!;
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error('[Toss confirm error]', tossData);
      // PaymentOrder 실패 처리
      await prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        { error: tossData.message ?? '결제 승인에 실패했습니다.' },
        { status: tossRes.status },
      );
    }

    // ── 납부 방법 매핑 ──────────────────────────────────────
    const METHOD_MAP: Record<string, PrismaPM> = {
      카드: PrismaPM.CARD,
      현금: PrismaPM.CASH,
      계좌이체: PrismaPM.TRANSFER,
      가상계좌: PrismaPM.TRANSFER,
      간편결제: PrismaPM.CARD,
    };
    const prismaMethod = METHOD_MAP[tossData.method] ?? PrismaPM.CARD;
    const paidDate = new Date(tossData.approvedAt ?? new Date());

    const billIds = order.billIds as string[];

    // ── DB 트랜잭션: 청구서 완납 + 영수증 발행 + 주문 완료 ──
    await prisma.$transaction(async (tx) => {
      for (const billId of billIds) {
        const bill = await tx.bill.findUnique({ where: { id: billId } });
        if (!bill) continue;

        const newPaid = bill.amount; // 전액 결제 처리
        await tx.bill.update({
          where: { id: billId },
          data: {
            paidAmount: newPaid,
            status: PrismaBS.PAID,
            method: prismaMethod,
            paidDate,
          },
        });

        await tx.receipt.create({
          data: {
            billId,
            studentId: bill.studentId,
            amount: bill.amount - bill.paidAmount, // 이번 결제액
            issuedDate: paidDate,
            method: prismaMethod,
            memo: `토스페이먼츠 결제 (${tossData.method})`,
          },
        });
      }

      await tx.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'PAID', paymentKey },
      });
    });

    return NextResponse.json({ success: true, method: tossData.method, approvedAt: tossData.approvedAt });
  } catch (err) {
    console.error('[POST /api/mobile/payments/toss/confirm]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
