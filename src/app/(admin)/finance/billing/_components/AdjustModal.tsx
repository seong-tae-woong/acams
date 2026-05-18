'use client';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import type { Bill } from '@/lib/types/finance';
import { toast } from '@/lib/stores/toastStore';
import { fieldClass } from '../_shared';

interface AdjustModalProps {
  open: boolean;
  onClose: () => void;
  target: Bill | null;
}

export default function AdjustModal({ open, onClose, target }: AdjustModalProps) {
  const { adjustBill } = useFinanceStore();

  const [adjustAmt, setAdjustAmt] = useState(String(target?.adjustAmount ?? ''));
  const [adjustMemoVal, setAdjustMemoVal] = useState(target?.adjustMemo ?? '');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const handleAdjust = async () => {
    if (!target) return;
    const amt = Number(adjustAmt || 0);
    if (amt < 0) { toast('차감 금액은 0 이상이어야 합니다.', 'error'); return; }
    if (amt >= target.amount) { toast('차감 금액이 청구액 이상일 수 없습니다.', 'error'); return; }
    setAdjustSaving(true);
    try {
      await adjustBill(target.id, amt, adjustMemoVal);
    } catch {
      return;
    } finally {
      setAdjustSaving(false);
    }
    toast(`조정 저장 완료 (차감 ${amt.toLocaleString()}원)`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="청구액 조정" size="sm"
      footer={<><Button variant="default" size="md" onClick={onClose}>취소</Button><Button variant="dark" size="md" onClick={handleAdjust} disabled={adjustSaving}>{adjustSaving ? '저장 중...' : '저장'}</Button></>}
    >
      {target && (
        <div className="space-y-3">
          <div className="p-3 bg-[#f4f6f8] rounded-[8px] text-[12.5px]"><div className="font-semibold text-[#111827]">{target.studentName}</div><div className="text-[#6b7280]">{target.className} · 청구액 {target.amount.toLocaleString()}원</div></div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">차감 금액</label>
            <input type="number" placeholder="0" value={adjustAmt} onChange={(e) => setAdjustAmt(e.target.value)} className={fieldClass} />
            <div className="text-[11px] text-[#9ca3af] mt-1">실납부액: {(target.amount - Number(adjustAmt || 0)).toLocaleString()}원</div>
          </div>
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">조정 사유</label><input type="text" placeholder="예) 3/15 수업 결석으로 인한 차감" value={adjustMemoVal} onChange={(e) => setAdjustMemoVal(e.target.value)} className={fieldClass} /></div>
        </div>
      )}
    </Modal>
  );
}
