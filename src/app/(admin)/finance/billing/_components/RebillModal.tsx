'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { toast } from '@/lib/stores/toastStore';
import { Loader2 } from 'lucide-react';
import type { RebillItem } from '../_shared';

interface RebillModalProps {
  open: boolean;
  onClose: () => void;
  cancelledIds: string[];
  refetchBills: () => Promise<void>;
  clearSelection: () => void;
}

export default function RebillModal({ open, onClose, cancelledIds, refetchBills, clearSelection }: RebillModalProps) {
  const { previewRebill, rebill } = useFinanceStore();

  const [rebillItems, setRebillItems] = useState<RebillItem[]>([]);
  const [rebillLoading, setRebillLoading] = useState(true);
  const [rebillSaving, setRebillSaving] = useState(false);
  const [rebillSendNotif, setRebillSendNotif] = useState(true);

  // 모달은 열릴 때마다 새로 마운트되므로(부모의 {rebillOpen && ...} 가드)
  // 마운트 시 1회만 출결 기반 금액을 미리 계산한다.
  useEffect(() => {
    let cancelled = false;
    setRebillLoading(true);
    (async () => {
      try {
        const previews = await previewRebill(cancelledIds);
        if (cancelled) return;
        const today25 = (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-25`;
        })();
        setRebillItems(previews.map((p) => ({
          ...p,
          amount: p.calculatedAmount,
          dueDate: today25,
        })));
      } catch {
        if (!cancelled) onClose();
      } finally {
        if (!cancelled) setRebillLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRebill = async () => {
    const items = rebillItems.map((r) => ({ billId: r.billId, amount: r.amount, dueDate: r.dueDate }));
    if (items.some((i) => !i.amount || i.amount <= 0)) { toast('모든 재청구 금액을 입력해주세요.', 'error'); return; }
    setRebillSaving(true);
    try {
      await rebill(items, rebillSendNotif);
      onClose();
      clearSelection();
      await refetchBills();
    } catch { /* store handles toast */ } finally {
      setRebillSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!rebillSaving) onClose(); }}
      title="재청구"
      size="lg"
      footer={
        <>
          <Button variant="default" size="md" onClick={onClose} disabled={rebillSaving}>취소</Button>
          <Button variant="dark" size="md" onClick={handleRebill} disabled={rebillSaving || rebillLoading}>
            {rebillSaving ? '생성 중...' : `재청구 ${rebillItems.length}건 생성`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {rebillLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-[13px] text-[#6b7280]">
            <Loader2 size={16} className="animate-spin" /> 출결 기반 금액 계산 중...
          </div>
        ) : (
          <>
            <div className="p-3.5 bg-[#EDE9FE] border border-[#c4b5fd] rounded-[8px] text-[12.5px] text-[#5B21B6]">
              실출결 기준으로 자동 계산된 금액이 입력되어 있습니다. 원장님이 직접 수정 후 생성하세요.
              재청구 알림은 학부모 앱에 <strong>&ldquo;해당 월 결제 취소 후 재청구&rdquo;</strong> 문구로 발송됩니다.
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#f4f6f8]">
                  <th className="text-left px-3 py-2 text-[#6b7280] font-medium">학생</th>
                  <th className="text-left px-3 py-2 text-[#6b7280] font-medium">반</th>
                  <th className="text-center px-3 py-2 text-[#6b7280] font-medium">청구 월</th>
                  <th className="text-right px-3 py-2 text-[#6b7280] font-medium">자동계산액</th>
                  <th className="text-right px-3 py-2 text-[#6b7280] font-medium">최종 청구액</th>
                  <th className="text-center px-3 py-2 text-[#6b7280] font-medium">납부기한</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {rebillItems.map((r, i) => (
                  <tr key={r.billId}>
                    <td className="px-3 py-2.5 text-[#111827] font-medium">{r.studentName}</td>
                    <td className="px-3 py-2.5 text-[#374151]">{r.className}</td>
                    <td className="px-3 py-2.5 text-center text-[#374151]">
                      {`${r.month.slice(0, 4)}년 ${parseInt(r.month.slice(5, 7))}월`}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#6b7280]">{r.calculatedAmount.toLocaleString()}원</td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        value={r.amount}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setRebillItems((prev) => prev.map((x, j) => j === i ? { ...x, amount: v } : x));
                        }}
                        className="w-28 text-right text-[12.5px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="date"
                        value={r.dueDate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRebillItems((prev) => prev.map((x, j) => j === i ? { ...x, dueDate: v } : x));
                        }}
                        className="text-[12px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rebillNotif"
                checked={rebillSendNotif}
                onChange={(e) => setRebillSendNotif(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#4fc3a1] cursor-pointer"
              />
              <label htmlFor="rebillNotif" className="text-[12.5px] text-[#374151] cursor-pointer">
                재청구 생성 후 학부모 알림 발송
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
