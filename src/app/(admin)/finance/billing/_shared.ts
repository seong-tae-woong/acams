// 청구/수납/미납 — 공용 상수·헬퍼

import { BillStatus } from '@/lib/types/finance';
import type { Bill } from '@/lib/types/finance';

// Layer 2+3 조정 항목 (알림 메시지에 내역 삽입용)
export interface AdjustmentLine {
  label: string;
  direction: 'discount' | 'add';
  amount: number;
  amountType: 'fixed' | 'percent';
}

export function generateBillingContent(academyName: string, studentName: string, bills: Bill[], monthStr: string): string {
  const lines = bills.map((b) => {
    const effectiveAmt = b.amount - (b.adjustAmount ?? 0);
    return `• ${b.className} | ${effectiveAmt.toLocaleString()}원${b.adjustMemo ? ` (${b.adjustMemo})` : ''}`;
  });
  const total = bills.reduce((s, b) => s + b.amount - (b.adjustAmount ?? 0), 0);
  return [
    `안녕하세요, ${academyName}입니다.`,
    ``,
    `${studentName} 학부모님, ${monthStr} 수강료가 청구되었습니다.`,
    ``,
    `📋 반별 청구 내역`,
    ...lines,
    ``,
    `청구 총액: ${total.toLocaleString()}원`,
    ``,
    `아래 [결제하기] 버튼을 눌러 납부를 진행해 주시기 바랍니다.`,
    `납부 기한을 확인하신 후 기한 내 납부해 주시기 바랍니다.`,
    ``,
    `감사합니다.`,
  ].join('\n');
}

/**
 * generateBillingContentWithAdjustments
 * generateBillingContent의 확장판 — 반별 조정 내역(Layer 2+3)을 함께 표시.
 * 조정 항목이 없는 반은 기존 포맷과 동일하게 출력.
 */
export function generateBillingContentWithAdjustments(
  academyName: string,
  studentName: string,
  bills: (Bill & { adjustments?: AdjustmentLine[] })[],
  monthStr: string,
): string {
  const lines: string[] = [];

  for (const b of bills) {
    const adjs = b.adjustments ?? [];
    const effectiveAmt = b.amount - (b.adjustAmount ?? 0);

    if (adjs.length === 0) {
      lines.push(`• ${b.className} | ${effectiveAmt.toLocaleString()}원${b.adjustMemo ? ` (${b.adjustMemo})` : ''}`);
    } else {
      lines.push(`• ${b.className}`);
      lines.push(`  기본 수강료: ${(b.amount).toLocaleString()}원`);  // 실제론 baseFee가 이상적이나 Bill 타입에 없으므로 amount 사용
      for (const adj of adjs) {
        const sign = adj.direction === 'discount' ? '-' : '+';
        const val = adj.amountType === 'percent' ? `${adj.amount}%` : `${adj.amount.toLocaleString()}원`;
        lines.push(`  ${sign} ${adj.label}: ${val}`);
      }
      lines.push(`  → 최종: ${effectiveAmt.toLocaleString()}원`);
    }
  }

  const total = bills.reduce((s, b) => s + b.amount - (b.adjustAmount ?? 0), 0);

  return [
    `안녕하세요, ${academyName}입니다.`,
    ``,
    `${studentName} 학부모님, ${monthStr} 수강료가 청구되었습니다.`,
    ``,
    `📋 반별 청구 내역`,
    ...lines,
    ``,
    `청구 총액: ${total.toLocaleString()}원`,
    ``,
    `아래 [결제하기] 버튼을 눌러 납부를 진행해 주시기 바랍니다.`,
    `납부 기한을 확인하신 후 기한 내 납부해 주시기 바랍니다.`,
    ``,
    `감사합니다.`,
  ].join('\n');
}

export const STATUS_STYLE: Record<BillStatus, { label: string; bg: string; text: string }> = {
  [BillStatus.DRAFT]:     { label: '초안',   bg: '#FEF3C7', text: '#92400E' },
  [BillStatus.PAID]:      { label: '완납',   bg: '#D1FAE5', text: '#065f46' },
  [BillStatus.UNPAID]:    { label: '미납',   bg: '#FEE2E2', text: '#991B1B' },
  [BillStatus.PARTIAL]:   { label: '부분납', bg: '#FEF3C7', text: '#92400E' },
  [BillStatus.CANCELLED]: { label: '취소됨', bg: '#F1F5F9', text: '#6b7280' },
};

export const METHOD_STYLE: Record<string, { bg: string; text: string }> = {
  '카드':    { bg: '#DBEAFE', text: '#1d4ed8' },
  '계좌이체': { bg: '#E1F5EE', text: '#065f46' },
  '현금':    { bg: '#FEF3C7', text: '#92400E' },
};

export const RISK_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  '위험': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  '주의': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  '경고': { bg: '#DBEAFE', text: '#1d4ed8', border: '#BFDBFE' },
};

export function getRiskLevel(bill: { status: BillStatus; memo: string }) {
  if (bill.memo.includes('2개월') || bill.memo.includes('3월도')) return '위험';
  if (bill.status === BillStatus.UNPAID) return '주의';
  return '경고';
}

export const today = new Date().toISOString().split('T')[0];
export const currentMonth = today.slice(0, 7);

export function prevMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
}

export function generateOverdueContent(academyName: string, studentName: string, unpaidBills: Bill[]): string {
  const lines = unpaidBills.map((b) => {
    const due = b.amount - b.paidAmount;
    return `• ${formatMonth(b.month)} | ${b.className} | ${due.toLocaleString()}원`;
  });
  const total = unpaidBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
  return [
    `안녕하세요, ${academyName}입니다.`,
    ``,
    `${studentName} 학부모님, 현재 아래와 같이 수강료가 미납되어 있습니다.`,
    ``,
    `📋 미납 내역`,
    ...lines,
    ``,
    `미납 총액: ${total.toLocaleString()}원`,
    ``,
    `아래 [결제하기] 버튼을 눌러 납부를 진행해 주시기 바랍니다.`,
    `빠른 납부에 감사드립니다.`,
  ].join('\n');
}

export const FINANCE_TABS = [
  { value: 'billing', label: '청구 및 수납' },
  { value: 'payments', label: '수납 내역' },
  { value: 'overdue', label: '미납 관리' },
];

export const fieldClass = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

// 재청구 항목 타입
export interface RebillItem {
  billId: string;
  studentName: string;
  className: string;
  month: string;
  calculatedAmount: number;
  amount: number;
  dueDate: string;
  feeType: string;
}

// 청구서 발송 대상 타입
export interface BillingNotifTarget {
  studentId: string;
  studentName: string;
  bills: Bill[];
  total: number;
}
