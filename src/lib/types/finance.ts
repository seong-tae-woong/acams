// 재무/청구 관련 타입 정의

export type PaymentMethod = '카드' | '계좌이체' | '현금';

export enum BillStatus {
  PAID = '완납',
  UNPAID = '미납',
  PARTIAL = '부분납',
  CANCELLED = '취소됨',
}

export interface Bill {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  month: string; // "YYYY-MM"
  amount: number; // 청구 금액
  paidAmount: number; // 납부 금액
  status: BillStatus;
  dueDate: string; // ISO date string
  paidDate: string | null; // 납부일 (미납 시 null)
  method: PaymentMethod | null; // 납부 방법 (미납 시 null)
  memo: string;
  adjustAmount?: number; // 조정 차감 금액 (수업 결석 등)
  adjustMemo?: string;   // 조정 사유
  adjustCount?: number;  // 이 청구서의 누적 조정 횟수
  feeType?: string;         // "monthly" | "per-lesson"
  scheduledCount?: number | null; // per-lesson: 배정 수업 횟수
  absentCount?: number | null;    // per-lesson: 결석 횟수
  makeupCount?: number | null;    // per-lesson: 보강으로 복원된 횟수
  notifiedAt?: string | null;     // 청구서 발송 시각 (null = 미발송)
  cancelledAt?: string | null;    // 취소 시각 (null = 취소 안됨)
  cancelReason?: string | null;   // 취소 사유
  paymentOrderId?: string | null; // 결제 주문 ID
  rebillOfId?: string | null;     // 재청구 시 원본 취소 청구서 ID
}

// 청구액 조정 이력 1건
export interface BillAdjustment {
  id: string;
  billId: string;
  month: string;        // 청구 월 "YYYY-MM"
  className: string;
  amount: number;       // 이 조정으로 설정된 차감 금액
  memo: string;         // 조정 사유
  createdByName: string; // 조정 처리자 이름
  createdAt: string;    // ISO datetime
}

export interface Expense {
  id: string;
  category: string; // 임대료, 강사비, 교재비, 공과금 등
  description: string;
  amount: number;
  date: string; // ISO date string
  memo: string;
}

export interface Receipt {
  id: string;
  billId: string;
  studentId: string;
  studentName: string;
  amount: number;
  issuedDate: string; // ISO date string
  method: PaymentMethod;
  memo: string;
  cancelledAt?: string | null; // 취소 시각
}

export type BillCreateInput = Omit<Bill, 'id' | 'status' | 'paidAmount' | 'paidDate' | 'method'>;

export type BillPaymentInput = {
  billId: string;
  amount: number;
  method: PaymentMethod;
  paidDate: string;
};

export type ExpenseCreateInput = Omit<Expense, 'id'>;

export interface BillFilter {
  studentId?: string;
  classId?: string;
  status?: BillStatus;
  month?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
}

export interface FinanceSummary {
  period: string; // YYYY-MM
  totalBilled: number;
  totalCollected: number;
  totalUnpaid: number;
  totalExpenses: number;
  netIncome: number;
  collectionRate: number; // 0~100 (%)
}

export interface StudentBillSummary {
  studentId: string;
  studentName: string;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  bills: Bill[];
}
