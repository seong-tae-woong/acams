'use client';
import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { Student } from '@/lib/types/student';
import type { Bill } from '@/lib/types/finance';
import { toast } from '@/lib/stores/toastStore';

const BILL_STATUS_BADGE: Record<string, string> = {
  '완납': 'bg-[#D1FAE5] text-[#065f46]',
  '미납': 'bg-[#FEE2E2] text-[#991B1B]',
  '부분납': 'bg-[#FEF3C7] text-[#92400E]',
};

export default function PaymentTab({ student }: { student: Student }) {
  const [studentBills, setStudentBills] = useState<Bill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);

  useEffect(() => {
    setBillsLoading(true);
    fetch(`/api/finance/bills?studentId=${student.id}`)
      .then((r) => r.json())
      .then((data: Bill[]) => setStudentBills(data))
      .catch(() => toast('결제 정보를 불러오는 데 실패했습니다.', 'error'))
      .finally(() => setBillsLoading(false));
  }, [student.id]);

  const totalAmount = studentBills.reduce((s, b) => s + b.amount, 0);
  const paidAmount = studentBills.reduce((s, b) => s + b.paidAmount, 0);
  const unpaidAmount = totalAmount - paidAmount;
  const unpaidBills = studentBills.filter((b) => b.status !== '완납');

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
          <div className="text-[11px] text-[#9ca3af] mb-1">총 청구액</div>
          <div className="text-[15px] font-bold text-[#111827]">{totalAmount.toLocaleString()}원</div>
          <div className="text-[11px] text-[#9ca3af] mt-1">{studentBills.length}건</div>
        </div>
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
          <div className="text-[11px] text-[#9ca3af] mb-1">수납 완료</div>
          <div className="text-[15px] font-bold text-[#4fc3a1]">{paidAmount.toLocaleString()}원</div>
          <div className="text-[11px] text-[#9ca3af] mt-1">{studentBills.filter((b) => b.status === '완납').length}건</div>
        </div>
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
          <div className="text-[11px] text-[#9ca3af] mb-1">미납 잔액</div>
          <div className={`text-[15px] font-bold ${unpaidAmount > 0 ? 'text-[#ef4444]' : 'text-[#9ca3af]'}`}>{unpaidAmount.toLocaleString()}원</div>
          <div className="text-[11px] text-[#9ca3af] mt-1">{unpaidBills.length}건</div>
        </div>
      </div>

      {/* 수납 필요 항목 */}
      {unpaidBills.length > 0 && (
        <div className="bg-[#FFF7ED] rounded-[10px] border border-[#fed7aa] p-4">
          <div className="text-[12px] font-semibold text-[#92400E] mb-2">수납 필요 항목 ({unpaidBills.length}건)</div>
          <div className="space-y-1.5">
            {unpaidBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${BILL_STATUS_BADGE[bill.status] ?? ''}`}>{bill.status}</span>
                  <span className="text-[#92400E]">{bill.month} · {bill.className}</span>
                </div>
                <span className="font-semibold text-[#92400E]">
                  {(bill.amount - bill.paidAmount).toLocaleString()}원 미납
                  {bill.dueDate && <span className="font-normal text-[#b45309] ml-1.5">(납부기한 {bill.dueDate})</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 수납 이력 테이블 */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-[#111827]">수납 이력</span>
          <span className="text-[11.5px] text-[#9ca3af]">총 {studentBills.length}건</span>
        </div>
        {billsLoading ? (
          <div className="p-8 flex justify-center"><LoadingSpinner /></div>
        ) : studentBills.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-[#9ca3af]">청구 내역이 없습니다.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                {['월', '반', '청구금액', '납부금액', '납부방법', '상태', '납부일'].map((h) => (
                  <th key={h} className={`px-4 py-2.5 text-[11.5px] text-[#6b7280] font-medium ${['청구금액', '납부금액'].includes(h) ? 'text-right' : h === '납부방법' || h === '상태' ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {studentBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-[#f9fafb]">
                  <td className="px-4 py-2.5 font-medium text-[#111827]">{bill.month}</td>
                  <td className="px-4 py-2.5 text-[#374151]">{bill.className}</td>
                  <td className="px-4 py-2.5 text-right text-[#374151]">{bill.amount.toLocaleString()}원</td>
                  <td className="px-4 py-2.5 text-right text-[#374151]">{bill.paidAmount.toLocaleString()}원</td>
                  <td className="px-4 py-2.5 text-center text-[#6b7280]">{bill.method ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${BILL_STATUS_BADGE[bill.status] ?? 'bg-[#f3f4f6] text-[#374151]'}`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#6b7280]">{bill.paidDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
