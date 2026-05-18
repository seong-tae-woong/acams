'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import type { BillAdjustment } from '@/lib/types/finance';
import { toast } from '@/lib/stores/toastStore';
import { formatMonth } from '../_shared';

interface AdjustHistoryModalProps {
  open: boolean;
  onClose: () => void;
  student: { id: string; name: string } | null;
}

export default function AdjustHistoryModal({ open, onClose, student }: AdjustHistoryModalProps) {
  const { fetchBillAdjustments } = useFinanceStore();

  const [adjustHistRows, setAdjustHistRows] = useState<BillAdjustment[]>([]);
  const [adjustHistLoading, setAdjustHistLoading] = useState(false);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    setAdjustHistRows([]);
    setAdjustHistLoading(true);
    (async () => {
      try {
        const rows = await fetchBillAdjustments(student.id);
        if (!cancelled) setAdjustHistRows(rows);
      } catch {
        if (!cancelled) toast('조정 이력을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setAdjustHistLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [student, fetchBillAdjustments]);

  return (
    <Modal open={open} onClose={onClose} title={`${student?.name ?? ''} 청구액 조정 이력`} size="md"
      footer={<Button variant="default" size="md" onClick={onClose}>닫기</Button>}
    >
      {adjustHistLoading ? (
        <div className="text-center text-[13px] text-[#9ca3af] py-6">불러오는 중...</div>
      ) : adjustHistRows.length === 0 ? (
        <div className="text-center text-[13px] text-[#9ca3af] py-6">조정 이력이 없습니다.</div>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-[#f4f6f8]">
              {['일시', '청구 월 · 반', '차감액', '사유', '처리자'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[#6b7280] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {adjustHistRows.map((a) => (
              <tr key={a.id} className="hover:bg-[#f9fafb]">
                <td className="px-3 py-2.5 text-[#374151] whitespace-nowrap">{new Date(a.createdAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2.5 text-[#374151]">{formatMonth(a.month)} · {a.className}</td>
                <td className="px-3 py-2.5 text-right text-[#991B1B]">-{a.amount.toLocaleString()}원</td>
                <td className="px-3 py-2.5 text-[#374151]">{a.memo || <span className="text-[#9ca3af]">-</span>}</td>
                <td className="px-3 py-2.5 text-[#6b7280]">{a.createdByName || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
