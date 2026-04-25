'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { formatKoreanDate } from '@/lib/utils/format';
import { ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import Link from 'next/link';

type BillStatus = 'PAID' | 'UNPAID' | 'PARTIAL';
type BillItem = { id: string; className: string; month: string; amount: number; paidAmount: number; status: BillStatus; dueDate: string; memo: string };
type ReceiptItem = { id: string; amount: number; issuedDate: string; method: string };

const STATUS_STYLE: Record<BillStatus, { label: string; bg: string; text: string; icon: typeof CheckCircle }> = {
  PAID:    { label: '완납',   bg: '#D1FAE5', text: '#065f46', icon: CheckCircle },
  UNPAID:  { label: '미납',   bg: '#FEE2E2', text: '#991B1B', icon: AlertCircle },
  PARTIAL: { label: '부분납', bg: '#FEF3C7', text: '#92400E', icon: AlertCircle },
};

export default function MobilePaymentsPage() {
  const [bills, setBills] = useState<BillItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/mobile/payments')
      .then((r) => r.json())
      .then((data) => {
        if (data.bills) setBills(data.bills);
        if (data.receipts) setReceipts(data.receipts);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalAmount = bills.reduce((s, b) => s + b.amount, 0);
  const totalPaid   = bills.reduce((s, b) => s + b.paidAmount, 0);

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
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[#6b7280]">납부액 / 청구액</span>
                      <span className="font-medium text-[#111827]">
                        {b.paidAmount.toLocaleString()} / {b.amount.toLocaleString()}원
                      </span>
                    </div>
                    {b.status !== 'PAID' && (
                      <div className="mt-3">
                        <button
                          className="w-full py-2.5 rounded-[10px] text-[13px] font-semibold text-white"
                          style={{ backgroundColor: '#4fc3a1' }}
                          onClick={() => toast('결제 페이지로 이동합니다. (추후 연동 예정)', 'info')}
                        >
                          {b.status === 'PARTIAL'
                            ? `잔여 ${(b.amount - b.paidAmount).toLocaleString()}원 납부`
                            : `${b.amount.toLocaleString()}원 납부하기`}
                        </button>
                      </div>
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
