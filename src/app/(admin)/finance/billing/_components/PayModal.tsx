'use client';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import type { Bill, PaymentMethod } from '@/lib/types/finance';
import { toast } from '@/lib/stores/toastStore';
import { fieldClass, today } from '../_shared';

interface PayModalProps {
  open: boolean;
  onClose: () => void;
  target: Bill | null;
}

export default function PayModal({ open, onClose, target }: PayModalProps) {
  const { payBill } = useFinanceStore();

  const initialAmount = target ? String((target.amount - (target.adjustAmount ?? 0)) - target.paidAmount) : '';
  const [payAmount, setPayAmount] = useState(initialAmount);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('카드');
  const [payDate, setPayDate] = useState(today);

  const handlePay = () => {
    if (!target) return;
    const amount = Number(payAmount);
    const effectiveAmount = target.amount - (target.adjustAmount ?? 0);
    if (!amount || amount <= 0) { toast('수납 금액을 입력해주세요.', 'error'); return; }
    if (amount > effectiveAmount - target.paidAmount) { toast('수납액이 잔여 금액을 초과합니다.', 'error'); return; }
    payBill(target.id, amount, payMethod, payDate);
    toast(`${target.studentName} 수납 처리 완료 (${amount.toLocaleString()}원)`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="수납 처리" size="sm"
      footer={<><Button variant="default" size="md" onClick={onClose}>취소</Button><Button variant="dark" size="md" onClick={handlePay}>수납 완료</Button></>}
    >
      {target && (
        <div className="space-y-3">
          <div className="p-3 bg-[#f4f6f8] rounded-[8px] text-[12.5px]">
            <div className="font-semibold text-[#111827]">{target.studentName}</div>
            <div className="text-[#6b7280]">{target.className} · 청구 {target.amount.toLocaleString()}원</div>
            {(target.adjustAmount ?? 0) > 0 && <div className="text-[#991B1B] text-[11.5px]">차감 -{(target.adjustAmount ?? 0).toLocaleString()}원{target.adjustMemo && <span className="ml-1 text-[#6b7280]">({target.adjustMemo})</span>}</div>}
            <div className="text-[#991B1B] font-medium">잔여 {(target.amount - (target.adjustAmount ?? 0) - target.paidAmount).toLocaleString()}원</div>
          </div>
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">수납 금액 *</label><input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={fieldClass} /></div>
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">납부 방법</label><select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className={fieldClass}><option value="카드">카드</option><option value="계좌이체">계좌이체</option><option value="현금">현금</option></select></div>
          <div><label className="text-[11.5px] text-[#6b7280] block mb-1">납부일</label><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={fieldClass} /></div>
        </div>
      )}
    </Modal>
  );
}
