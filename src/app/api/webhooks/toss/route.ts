import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS, PaymentMethod as PrismaPM } from '@/generated/prisma/client';
import { decryptTossKey } from '@/lib/crypto/tossKey';
import type { TossWebhookPayload } from '@/lib/types/toss';

/**
 * POST /api/webhooks/toss?academyId=<academyId>
 *
 * 토스페이먼츠가 결제 상태 변경 시 서버로 직접 호출하는 웹훅 엔드포인트.
 * 학부모가 브라우저를 닫거나 네트워크 오류로 /success 리다이렉트가 실패해도
 * 이 웹훅을 통해 수납 처리가 완료됩니다.
 *
 * [Toss 대시보드 설정]
 * 웹훅 URL: https://<your-domain>/api/webhooks/toss?academyId=<academyId>
 * 학원별로 academyId를 달리해 등록 (슈퍼어드민이 토스키 등록 시 안내).
 *
 * [서명 검증]
 * Toss-Signature 헤더: t=<unix_timestamp>,v1=<hmac_sha256_hex>
 * 서명 대상: "<timestamp>.<raw_body>"
 * 알고리즘: HMAC-SHA256 (키: Toss 시크릿 키)
 * 타임스탬프 허용 오차: 5분
 */

const METHOD_MAP: Record<string, PrismaPM> = {
  카드: PrismaPM.CARD,
  현금: PrismaPM.CASH,
  계좌이체: PrismaPM.TRANSFER,
  가상계좌: PrismaPM.TRANSFER,
  간편결제: PrismaPM.CARD,
};

function verifyTossSignature(
  signatureHeader: string | null,
  rawBody: string,
  secretKey: string,
): boolean {
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) parts[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
  }

  const timestamp = parts['t'];
  const expected  = parts['v1'];
  if (!timestamp || !expected) return false;

  // 5분 이상 지난 요청 거부 (replay attack 방지)
  const diffSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (diffSec > 300) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const computed = createHmac('sha256', secretKey).update(signedPayload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    // 길이가 다를 경우 timingSafeEqual 예외 → 불일치
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const academyId = searchParams.get('academyId');

  if (!academyId) {
    return NextResponse.json({ error: 'academyId is required' }, { status: 400 });
  }

  // 서명 검증 전에 raw body를 읽어야 함 (파싱 전)
  const rawBody = await req.text();

  try {
    // 학원 Secret Key 조회
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { tossSecretKeyEnc: true },
    });
    if (!academy?.tossSecretKeyEnc) {
      // 등록되지 않은 학원 → 조용히 200 반환 (Toss 재전송 방지)
      console.warn('[Toss webhook] 학원 키 미등록:', academyId);
      return NextResponse.json({ ok: true });
    }

    let tossSecretKey: string;
    try {
      tossSecretKey = decryptTossKey(academy.tossSecretKeyEnc);
    } catch {
      console.error('[Toss webhook] 키 복호화 실패:', academyId);
      return NextResponse.json({ error: 'Key error' }, { status: 500 });
    }

    // ── 서명 검증 ────────────────────────────────────────────
    const signatureHeader = req.headers.get('Toss-Signature');
    if (!verifyTossSignature(signatureHeader, rawBody, tossSecretKey)) {
      console.error('[Toss webhook] 서명 검증 실패:', academyId, signatureHeader);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // ── 페이로드 파싱 ────────────────────────────────────────
    const payload = JSON.parse(rawBody) as TossWebhookPayload;

    // PAYMENT_STATUS_CHANGED 이벤트의 DONE 상태만 처리
    if (payload.eventType !== 'PAYMENT_STATUS_CHANGED' || payload.data?.status !== 'DONE') {
      return NextResponse.json({ ok: true });
    }

    const { paymentKey, orderId, approvedAt, method: tossMethod } = payload.data;

    // PaymentOrder 조회 — 이미 PAID면 멱등 처리
    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      console.warn('[Toss webhook] 주문 없음:', orderId);
      return NextResponse.json({ ok: true });
    }
    if (order.academyId !== academyId) {
      console.error('[Toss webhook] 학원 불일치:', orderId, academyId);
      return NextResponse.json({ error: 'Academy mismatch' }, { status: 403 });
    }
    if (order.status === 'PAID') {
      return NextResponse.json({ ok: true });
    }
    if (order.status === 'PROCESSING') {
      // confirm이 진행 중인 경우 — 5분 이내면 confirm에 위임, 5분 초과면 서버 크래시로 고착된 것으로 판단하고 웹훅이 처리
      const staleSec = (Date.now() - new Date(order.updatedAt).getTime()) / 1000;
      if (staleSec < 300) return NextResponse.json({ ok: true });
      // 5분 초과 PROCESSING → 아래 트랜잭션에서 처리
    }

    const prismaMethod = METHOD_MAP[tossMethod ?? ''] ?? PrismaPM.CARD;
    const paidDate = new Date(approvedAt ?? new Date());
    const billIds = order.billIds as string[];

    // ── DB 트랜잭션: 청구서 완납 + 영수증 발행 + 주문 완료 ──
    await prisma.$transaction(async (tx) => {
      for (const billId of billIds) {
        const bill = await tx.bill.findUnique({ where: { id: billId } });
        if (!bill || bill.status === PrismaBS.PAID) continue;

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
            memo: `토스페이먼츠 결제 (${tossMethod ?? '카드'}) [웹훅]`,
          },
        });
      }

      await tx.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'PAID', paymentKey },
      });
    });

    console.info('[Toss webhook] 수납 처리 완료:', orderId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/webhooks/toss]', err);
    // 500을 반환하면 Toss가 재전송함 (의도적)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
