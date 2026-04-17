// 재무/청구 관련 타입 정의

export type PaymentMethod = '카드' | '계좌이체' | '현금';

export enum BillStatus {
  PAID = '완납',
  UNPAID = '미납',
  PARTIAL = '부분납',
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
