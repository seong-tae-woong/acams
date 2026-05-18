'use client';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { STATUS_STYLE, formatMonth } from '../_shared';

interface PaymentHistoryModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string | null;
}

export default function PaymentHistoryModal({ open, onClose, studentId }: PaymentHistoryModalProps) {
  const { getBillsByStudent } = useFinanceStore();

  const detailBills = studentId
    ? getBillsByStudent(studentId).sort((a, b) => b.month.localeCompare(a.month))
    : [];
  const detailStudentName = detailBills[0]?.studentName ?? '';

  return (
    <Modal open={open} onClose={onClose} title={`${detailStudentName} 수강료 납부 이력`} size="md"
      footer={<Button variant="default" size="md" onClick={onClose}>닫기</Button>}
    >
      <div className="space-y-1">
        {detailBills.length === 0 ? (
          <div className="text-center text-[13px] text-[#9ca3af] py-6">이력이 없습니다.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-[#f4f6f8]">
                {['청구 월', '반', '청구액', '납부액', '미납액', '상태'].map((h) => <th key={h} className="px-3 py-2 text-left text-[#6b7280] font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {detailBills.map((b) => {
                const st = STATUS_STYLE[b.status];
                const unpaid = b.amount - b.paidAmount;
                return (
                  <tr key={b.id} className="hover:bg-[#f9fafb]">
                    <td className="px-3 py-2.5 text-[#374151]">{formatMonth(b.month)}</td>
                    <td className="px-3 py-2.5 text-[#374151]">{b.className}</td>
                    <td className="px-3 py-2.5 text-right text-[#111827]">{b.amount.toLocaleString()}원{(b.adjustAmount ?? 0) > 0 && <div className="text-[11px] text-[#991B1B]">-{(b.adjustAmount ?? 0).toLocaleString()}원 차감</div>}</td>
                    <td className="px-3 py-2.5 text-right text-[#111827]">{b.paidAmount.toLocaleString()}원</td>
                    <td className="px-3 py-2.5 text-right font-medium" style={{ color: unpaid > 0 ? '#991B1B' : '#065f46' }}>{unpaid > 0 ? `${unpaid.toLocaleString()}원` : '-'}</td>
                    <td className="px-3 py-2.5 text-center"><span className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#f4f6f8] font-semibold">
                <td className="px-3 py-2 text-[#374151]" colSpan={2}>합계</td>
                <td className="px-3 py-2 text-right text-[#111827]">{detailBills.reduce((s, b) => s + b.amount, 0).toLocaleString()}원</td>
                <td className="px-3 py-2 text-right text-[#0D9E7A]">{detailBills.reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}원</td>
                <td className="px-3 py-2 text-right text-[#991B1B]">{detailBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0).toLocaleString()}원</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </Modal>
  );
}
