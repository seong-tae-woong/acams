/** 토스페이먼츠 결제 응답 (confirm API / 웹훅 data 공통) */
export interface TossPaymentData {
  paymentKey: string;
  orderId: string;
  status: string;        // DONE | CANCELED | PARTIAL_CANCELED | ABORTED | EXPIRED
  approvedAt?: string;   // ISO 8601 with timezone, e.g. "2025-05-01T10:00:00+09:00"
  method?: string;       // 카드 | 현금 | 계좌이체 | 가상계좌 | 간편결제
  totalAmount?: number;
  amount?: number;
  code?: string;         // 오류 코드 (실패 응답 시)
  message?: string;      // 오류 메시지 (실패 응답 시)
}

/** 토스페이먼츠 웹훅 페이로드 */
export interface TossWebhookPayload {
  eventType: string;     // PAYMENT_STATUS_CHANGED | PAYMENT_CANCELED | ...
  createdAt: string;
  data: TossPaymentData;
}
