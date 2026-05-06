import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS } from '@/generated/prisma/client';
import { decryptTossKey } from '@/lib/crypto/tossKey';

/**
 * POST /api/finance/bills/[id]/cancel
 * 원장 전용 — 완납된 청구서를 취소 처리
 *
 * - 토스 결제(paymentOrderId 존재 + CARD/TRANSFER): 동일 PaymentOrder의 청구서 전체를 취소
 *   (토스는 주문 단위로 원 결제를 취소해야 하므로 분리 취소 불가)
 * - 현금 수납 등(paymentOrderId 없음): 해당 청구서만 취소
 * - 취소 시 연결된 영수증 모두 cancelledAt 기록
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  const role      = req.headers.get('x-user-role');

  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const { cancelReason } = await req.json().catch(() => ({ cancelReason: '원장 취소' }));
  const reason = cancelReason || '원장 취소';

  try {
    const bill = await prisma.bill.findUnique({
      where: { id },
      select: {
        id: true, academyId: true, status: true,
        paymentOrderId: true, method: true,
        amount: true,
      },
    });

    if (!bill) return NextResponse.json({ error: '청구서를 찾을 수 없습니다.' }, { status: 404 });
    if (bill.academyId !== academyId) return NextResponse.json({ error: '권한 없음' }, { status: 403 });
    if (bill.status !== PrismaBS.PAID) {
      return NextResponse.json({ error: '완납 상태의 청구서만 취소할 수 있습니다.' }, { status: 400 });
    }

    const now = new Date();

    // ── 토스 결제 취소 (CARD/TRANSFER + paymentOrderId 있음) ───────────────
    if (bill.paymentOrderId) {
      const order = await prisma.paymentOrder.findUnique({
        where: { id: bill.paymentOrderId },
        select: { id: true, paymentKey: true, amount: true, billIds: true, academyId: true },
      });

      if (order && order.paymentKey && order.academyId === academyId) {
        // 학원 Secret Key 조회
        const academy = await prisma.academy.findUnique({
          where: { id: academyId },
          select: { tossSecretKeyEnc: true },
        });

        if (academy?.tossSecretKeyEnc) {
          let tossSecretKey: string;
          try {
            tossSecretKey = decryptTossKey(academy.tossSecretKeyEnc);
          } catch {
            return NextResponse.json({ error: '결제 키 복호화 오류' }, { status: 500 });
          }

          // 토스 취소 API 호출
          const authHeader = `Basic ${Buffer.from(`${tossSecretKey}:`).toString('base64')}`;
          const tossRes = await fetch(
            `https://api.tosspayments.com/v1/payments/${order.paymentKey}/cancel`,
            {
              method: 'POST',
              headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
              body: JSON.stringify({ cancelReason: reason }),
            },
          );

          if (!tossRes.ok) {
            const errData = await tossRes.json().catch(() => ({})) as { message?: string };
            console.error('[Toss cancel error]', errData);
            return NextResponse.json(
              { error: errData.message ?? '토스 결제 취소에 실패했습니다.' },
              { status: 400 },
            );
          }
        }

        // PaymentOrder 내 모든 청구서 취소
        const billIds = order.billIds as string[];
        await prisma.$transaction(async (tx) => {
          for (const billId of billIds) {
            await tx.bill.updateMany({
              where: { id: billId, academyId },
              data: {
                status: PrismaBS.CANCELLED,
                cancelledAt: now,
                cancelReason: reason,
              },
            });
            await tx.receipt.updateMany({
              where: { billId },
              data: { cancelledAt: now },
            });
          }
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' },
          });
        });

        return NextResponse.json({ ok: true, cancelledBillIds: billIds });
      }
    }

    // ── 현금/수동 수납 취소 (paymentOrderId 없음) ─────────────────────────
    await prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id },
        data: { status: PrismaBS.CANCELLED, cancelledAt: now, cancelReason: reason },
      });
      await tx.receipt.updateMany({
        where: { billId: id },
        data: { cancelledAt: now },
      });
    });

    return NextResponse.json({ ok: true, cancelledBillIds: [id] });
  } catch (err) {
    console.error('[POST /api/finance/bills/[id]/cancel]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
