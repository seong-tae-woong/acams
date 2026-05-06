import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS, PaymentMethod as PrismaPM } from '@/generated/prisma/client';
import { decryptTossKey } from '@/lib/crypto/tossKey';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';
import type { TossPaymentData } from '@/lib/types/toss';

// POST /api/mobile/payments/toss/confirm
// 토스페이먼츠 결제 승인 → 청구서 상태 업데이트 + 영수증 발행
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId    = req.headers.get('x-user-id');
  const role      = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // orderId를 catch 블록에서 PROCESSING 복구에 사용하기 위해 미리 선언
  let claimedOrderId: string | undefined;

  try {
    const { paymentKey, orderId, amount } = await req.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: 'paymentKey, orderId, amount는 필수입니다.' }, { status: 400 });
    }

    // 학원별 토스 Secret Key 조회
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { tossSecretKeyEnc: true },
    });
    if (!academy?.tossSecretKeyEnc) {
      return NextResponse.json({ error: '이 학원은 결제가 설정되지 않았습니다. 관리자에게 문의해주세요.' }, { status: 503 });
    }
    let tossSecretKey: string;
    try {
      tossSecretKey = decryptTossKey(academy.tossSecretKeyEnc);
    } catch {
      return NextResponse.json({ error: '결제 키 오류가 발생했습니다. 관리자에게 문의해주세요.' }, { status: 500 });
    }

    // PaymentOrder 조회 및 기본 검증
    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order || order.academyId !== academyId) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (order.status === 'PAID') {
      return NextResponse.json({ error: '이미 완료된 결제입니다.' }, { status: 409 });
    }
    if (order.status === 'PROCESSING') {
      return NextResponse.json({ error: '결제가 처리 중입니다. 잠시 후 확인해 주세요.' }, { status: 409 });
    }
    if (order.amount !== amount) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    // 학생 본인 확인 — order.studentId가 이 사용자의 자녀(또는 본인)인지 검증
    const studentId = await resolveStudentId({ userId, role: role ?? 'parent', academyId, requestedStudentId: order.studentId });

    if (!studentId || studentId !== order.studentId) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // ── Atomic claim: PENDING → PROCESSING (중복 결제 방지) ──
    // 두 요청이 동시에 들어와도 하나만 성공하도록 DB 수준에서 원자적으로 처리
    const claimed = await prisma.paymentOrder.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: '이미 처리 중이거나 완료된 결제입니다.' }, { status: 409 });
    }
    claimedOrderId = orderId; // catch 블록에서 복구에 사용

    // ── 토스페이먼츠 승인 API 호출 ──────────────────────────
    const authHeader = `Basic ${Buffer.from(`${tossSecretKey}:`).toString('base64')}`;

    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json() as TossPaymentData;

    if (!tossRes.ok) {
      console.error('[Toss confirm error]', tossData.code, tossData.message);
      await prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'FAILED' },
      });
      claimedOrderId = undefined; // 이미 FAILED 처리됨
      return NextResponse.json(
        { error: tossData.message ?? '결제 승인에 실패했습니다.', code: tossData.code },
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
    const prismaMethod = METHOD_MAP[tossData.method ?? ''] ?? PrismaPM.CARD;
    const paidDate = new Date(tossData.approvedAt ?? new Date());

    const billIds = order.billIds as string[];

    // ── DB 트랜잭션: 청구서 완납 + 영수증 발행 + 주문 완료 ──
    await prisma.$transaction(async (tx) => {
      for (const billId of billIds) {
        const bill = await tx.bill.findUnique({ where: { id: billId } });
        if (!bill) continue;

        await tx.bill.update({
          where: { id: billId },
          data: {
            paidAmount: bill.amount,
            status: PrismaBS.PAID,
            method: prismaMethod,
            paidDate,
            paymentOrderId: orderId,
          },
        });

        await tx.receipt.create({
          data: {
            billId,
            studentId: bill.studentId,
            amount: bill.amount - bill.paidAmount,
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

    claimedOrderId = undefined; // 정상 완료
    return NextResponse.json({ success: true, method: tossData.method, approvedAt: tossData.approvedAt });
  } catch (err) {
    console.error('[POST /api/mobile/payments/toss/confirm]', err);
    // Toss 승인 후 DB 업데이트 실패 시 PROCESSING → PENDING으로 복구 (웹훅이 최종 처리)
    if (claimedOrderId) {
      await prisma.paymentOrder.updateMany({
        where: { id: claimedOrderId, status: 'PROCESSING' },
        data: { status: 'PENDING' },
      }).catch(() => {});
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
