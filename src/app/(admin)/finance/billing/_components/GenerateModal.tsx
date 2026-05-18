'use client';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { toast } from '@/lib/stores/toastStore';
import { fieldClass, prevMonth } from '../_shared';

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
  refetchBills: () => Promise<void>;
}

export default function GenerateModal({ open, onClose, refetchBills }: GenerateModalProps) {
  const { generateBills, fetchAvailableMonths } = useFinanceStore();

  const [generateSaving, setGenerateSaving] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(prevMonth);

  const handleGenerateBills = async () => {
    setGenerateSaving(true);
    try {
      const result = await generateBills(generateMonth);
      toast(`청구서 생성 완료: ${result.created}건 신규, ${result.refreshed}건 갱신`, 'success');
      onClose();
      await refetchBills();
      await fetchAvailableMonths();
    } catch { /* store handles toast */ } finally {
      setGenerateSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="청구 생성"
      size="sm"
      footer={
        <>
          <Button variant="default" size="md" onClick={onClose}>취소</Button>
          <Button variant="dark" size="md" onClick={handleGenerateBills} disabled={generateSaving}>
            {generateSaving ? '생성 중...' : '생성'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-[13px] text-[#374151]">
          <strong>{generateMonth.replace('-', '년 ').replace(/(\d{2})$/, (m) => `${parseInt(m)}월`)}</strong> 청구서를 생성하시겠습니까?
        </div>
        <div>
          <label className="text-[11.5px] text-[#6b7280] block mb-1">청구 월</label>
          <input
            type="month"
            value={generateMonth}
            onChange={(e) => setGenerateMonth(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="p-3 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#6b7280] space-y-1">
          <div>• 활성 수강생 전체를 대상으로 청구서를 일괄 생성합니다.</div>
          <div>• 금액은 시간표 기준으로 산정됩니다 (초기 청구). 출결 반영은 재청구 흐름을 사용하세요.</div>
          <div>• 납부기한은 해당 월 25일로 자동 설정됩니다.</div>
        </div>
      </div>
    </Modal>
  );
}
