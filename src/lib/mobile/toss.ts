// 토스페이먼츠 결제 트리거 (모바일 학부모/학생 공용)
// 학원별 Client Key를 조회해 멀티테넌트 결제를 지원한다.

interface RequestTossPaymentParams {
  billIds: string[];
  amount: number;
  orderName: string;
  method?: 'CARD' | 'TRANSFER';
  studentId?: string | null;
}

export async function requestTossPayment({
  billIds,
  amount,
  orderName,
  method = 'CARD',
  studentId = null,
}: RequestTossPaymentParams): Promise<void> {
  // 1. 학원별 Client Key 조회
  const keyRes = await fetch('/api/mobile/payments/toss-client-key');
  if (!keyRes.ok) {
    const err = await keyRes.json();
    throw new Error(err.error ?? '결제 설정을 불러오지 못했습니다.');
  }
  const { clientKey } = await keyRes.json();

  // 2. PaymentOrder 생성
  const orderRes = await fetch('/api/mobile/payments/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ billIds, amount, ...(studentId ? { studentId } : {}) }),
  });
  if (!orderRes.ok) {
    const err = await orderRes.json();
    throw new Error(err.error ?? '주문 생성에 실패했습니다.');
  }
  const { orderId } = await orderRes.json();

  // 3. 토스페이먼츠 SDK 동적 로드
  const { loadTossPayments, ANONYMOUS } = await import('@tosspayments/tosspayments-sdk');
  const tossPayments = await loadTossPayments(clientKey);
  const payment = tossPayments.payment({ customerKey: ANONYMOUS });

  // 4. 결제 요청 — 카드/계좌이체 분기 (SDK discriminated union 타입 충족)
  const baseParams = {
    amount: { currency: 'KRW' as const, value: amount },
    orderId,
    orderName,
    successUrl: `${window.location.origin}/mobile/payments/success`,
    failUrl: `${window.location.origin}/mobile/payments/fail`,
  };
  if (method === 'TRANSFER') {
    await payment.requestPayment({ method: 'TRANSFER', ...baseParams });
  } else {
    await payment.requestPayment({ method: 'CARD', ...baseParams });
  }
}
