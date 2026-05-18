'use client';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import type { Bill } from '@/lib/types/finance';
import { fieldClass } from '../_shared';

interface CancelModalProps {
  open: boolean;
  onClose: () => void;
  target: Bill | null;
  refetchBills: () => Promise<void>;
  clearSelection: () => void;
}

export default function CancelModal({ open, onClose, target, refetchBills, clearSelection }: CancelModalProps) {
  const { cancelBill } = useFinanceStore();

  const [cancelReason, setCancelReason] = useState('원장 취소');
  const [cancelSaving, setCancelSaving] = useState(false);

  const handleCancel = async () => {
    if (!target) return;
    setCancelSaving(true);
    try {
      await cancelBill(target.id, cancelReason);
      onClose();
      await refetchBills();
      clearSelection();
    } catch { /* store handles toast */ } finally {
      setCancelSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="청구서 취소"
      size="sm"
      footer={
        <>
          <Button variant="default" size="md" onClick={onClose}>닫기</Button>
          <Button variant="danger" size="md" onClick={handleCancel} disabled={cancelSaving}>
            {cancelSaving ? '취소 처리 중...' : '취소 확정'}
          </Button>
        </>
      }
    >
      {target && (
        <div className="space-y-3">
          <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] text-[12.5px]">
            <div className="font-semibold text-[#991B1B]">{target.studentName} — {target.className}</div>
            <div className="text-[#991B1B] mt-0.5">{target.month} 청구액 {target.amount.toLocaleString()}원</div>
            {target.paymentOrderId && (
              <div className="text-[11.5px] text-[#991B1B] mt-1">
                ⚠️ 토스 결제 건입니다. 동일 주문의 청구서가 모두 함께 취소됩니다.
              </div>
            )}
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">취소 사유</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className={fieldClass}
              placeholder="취소 사유를 입력하세요"
            />
          </div>
          <div className="text-[11.5px] text-[#6b7280]">
            취소된 청구서는 &apos;취소됨&apos; 상태로 보존됩니다. 재청구가 필요하면 취소됨 상태 청구서를 선택 후 재청구 버튼을 눌러주세요.
          </div>
        </div>
      )}
    </Modal>
  );
}
