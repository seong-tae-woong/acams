'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { formatKoreanDate } from '@/lib/utils/format';
import { ChevronLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import Link from 'next/link';
import { useMobileChild } from '@/contexts/MobileChildContext';

type BillStatus = 'PAID' | 'UNPAID' | 'PARTIAL';
type BillItem = {
  id: string;
  className: string;
  month: string;
  amount: number;
  paidAmount: number;
  status: BillStatus;
  dueDate: string;
  memo: string;
};
type ReceiptItem = { id: string; amount: number; issuedDate: string; method: string };

const STATUS_STYLE: Record<BillStatus, { label: string; bg: string; text: string; icon: typeof CheckCircle }> = {
  PAID:    { label: '완납',   bg: '#D1FAE5', text: '#065f46', icon: CheckCircle },
  UNPAID:  { label: '미납',   bg: '#FEE2E2', text: '#991B1B', icon: AlertCircle },
  PARTIAL: { label: '부분납', bg: '#FEF3C7', text: '#92400E', icon: AlertCircle },
};

async function requestTossPayment(billId: string, amount: number, orderName: string) {
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
    body: JSON.stringify({ billIds: [billId], amount }),
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

  // 4. 결제 요청
  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: amount },
    orderId,
    orderName,
    successUrl: `${window.location.origin}/mobile/payments/success`,
    failUrl: `${window.location.origin}/mobile/payments/fail`,
  });
}

export default function MobilePaymentsPage() {
  const { selectedChildId } = useMobileChild();
  const [bills, setBills] = useState<BillItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    fetch(`/api/mobile/payments?studentId=${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.bills) setBills(data.bills);
        if (data.receipts) setReceipts(data.receipts);
      })
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  const totalAmount = bills.reduce((s, b) => s + b.amount, 0);
  const totalPaid   = bills.reduce((s, b) => s + b.paidAmount, 0);

  const handlePay = async (bill: BillItem) => {
    const remaining = bill.amount - bill.paidAmount;
    setPayingId(bill.id);
    try {
      await requestTossPayment(
        bill.id,
        remaining,
        `${bill.className} 수강료`,
      );
      // 결제 성공 시 successUrl로 리다이렉트됨
    } catch (err) {
      const msg = err instanceof Error ? err.message : '결제 중 오류가 발생했습니다.';
      toast(msg, 'error');
      setPayingId(null);
    }
  };

  return (
    <div className="flex flex-col pb-20">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">수납 내역</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-[10px] p-3">
            <div className="text-[13px] text-white/60">청구 총액</div>
            <div className="text-[20px] font-bold text-white">{totalAmount.toLocaleString()}원</div>
          </div>
          <div className="bg-white/10 rounded-[10px] p-3">
            <div className="text-[13px] text-white/60">납부 완료</div>
            <div className="text-[20px] font-bold text-[#4fc3a1]">{totalPaid.toLocaleString()}원</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {/* 청구 목록 */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
            <div className="px-4 py-3 border-b border-[#f1f5f9]">
              <span className="text-[13px] font-semibold text-[#111827]">청구 내역</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {bills.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-[#9ca3af]">청구 내역 없음</div>
              ) : bills.map((b) => {
                const ss = STATUS_STYLE[b.status];
                const Icon = ss.icon;
                const remaining = b.amount - b.paidAmount;
                const isPaying = payingId === b.id;

                return (
                  <div key={b.id} className="px-4 py-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-[13px] font-semibold text-[#111827]">{b.className}</div>
                        <div className="text-[11.5px] text-[#6b7280]">납부기한: {formatKoreanDate(b.dueDate)}</div>
                      </div>
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold"
                        style={{ backgroundColor: ss.bg, color: ss.text }}>
                        <Icon size={10} />{ss.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[12px] mb-3">
                      <span className="text-[#6b7280]">납부액 / 청구액</span>
                      <span className="font-medium text-[#111827]">
                        {b.paidAmount.toLocaleString()} / {b.amount.toLocaleString()}원
                      </span>
                    </div>
                    {b.status !== 'PAID' && (
                      <button
                        disabled={isPaying || payingId !== null}
                        onClick={() => handlePay(b)}
                        className="w-full py-2.5 rounded-[10px] text-[13px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:opacity-80"
                        style={{ backgroundColor: '#4fc3a1' }}
                      >
                        {isPaying ? (
                          <><Loader2 size={14} className="animate-spin" /> 결제 준비 중...</>
                        ) : b.status === 'PARTIAL' ? (
                          `잔여 ${remaining.toLocaleString()}원 납부하기`
                        ) : (
                          `${b.amount.toLocaleString()}원 납부하기`
                        )}
                      </button>
                    )}
                    {b.memo && <div className="mt-1 text-[11px] text-[#9ca3af]">{b.memo}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 영수증 이력 */}
          {receipts.length > 0 && (
            <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
              <div className="px-4 py-3 border-b border-[#f1f5f9]">
                <span className="text-[13px] font-semibold text-[#111827]">영수증 이력</span>
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {receipts.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-[12.5px] font-medium text-[#111827]">{formatKoreanDate(r.issuedDate)}</div>
                      <div className="text-[11.5px] text-[#6b7280]">{r.method}</div>
                    </div>
                    <div className="text-[13px] font-bold text-[#0D9E7A]">{r.amount.toLocaleString()}원</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <BottomTabBar />
    </div>
  );
}
