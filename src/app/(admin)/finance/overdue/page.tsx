'use client';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { BillStatus } from '@/lib/types/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { Send, Phone } from 'lucide-react';
import clsx from 'clsx';

// 위험 등급 분류
function getRiskLevel(bill: { status: BillStatus; memo: string; studentName: string }) {
  if (bill.memo.includes('2개월') || bill.memo.includes('3월도')) return '위험';
  if (bill.status === BillStatus.UNPAID) return '주의';
  if (bill.status === BillStatus.PARTIAL) return '경고';
  return '정상';
}

const RISK_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  '위험': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  '주의': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  '경고': { bg: '#DBEAFE', text: '#1d4ed8', border: '#BFDBFE' },
  '정상': { bg: '#D1FAE5', text: '#065f46', border: '#A7F3D0' },
};

export default function OverduePage() {
  const { bills, payBill } = useFinanceStore();

  const overdueBills = bills
    .filter((b) => b.status !== BillStatus.PAID)
    .map((b) => ({ ...b, risk: getRiskLevel(b) }))
    .sort((a, b) => {
      const order = ['위험', '주의', '경고'];
      return order.indexOf(a.risk) - order.indexOf(b.risk);
    });

  const totalOverdue = overdueBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
  const danger = overdueBills.filter((b) => b.risk === '위험').length;
  const warning = overdueBills.filter((b) => b.risk === '주의').length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="미납 관리"
        badge={`미납 ${overdueBills.length}명`}
        actions={<Button variant="default" size="sm"><Send size={13} /> 미납 알림 일괄 발송</Button>}
      />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 미납 현황 KPI */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
            <div className="text-[22px] font-bold text-[#991B1B]">{(totalOverdue / 10000).toFixed(0)}만원</div>
            <div className="text-[11.5px] text-[#6b7280] mt-1">미납 총액</div>
          </div>
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
            <div className="text-[22px] font-bold text-[#991B1B]">{danger}명</div>
            <div className="text-[11.5px] text-[#6b7280] mt-1">위험 (2개월 이상)</div>
          </div>
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
            <div className="text-[22px] font-bold text-[#92400E]">{warning}명</div>
            <div className="text-[11.5px] text-[#6b7280] mt-1">주의 (1개월)</div>
          </div>
        </div>

        {/* 미납 목록 */}
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0]">
            <span className="text-[12.5px] font-semibold text-[#111827]">미납/부분납 현황</span>
          </div>
          {overdueBills.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-[#9ca3af]">모든 수강료가 수납되었습니다</div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#f4f6f8]">
                  <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium w-20">위험도</th>
                  <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">학생</th>
                  <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">반</th>
                  <th className="text-right px-4 py-2.5 text-[#6b7280] font-medium">미납액</th>
                  <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">납부기한</th>
                  <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">메모</th>
                  <th className="px-4 py-2.5 text-[#6b7280] font-medium text-center">조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {overdueBills.map((b) => {
                  const rs = RISK_STYLE[b.risk];
                  const overAmount = b.amount - b.paidAmount;
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-[#f9fafb]"
                      style={{ borderLeft: `3px solid ${rs.border}` }}
                    >
                      <td className="px-4 py-3 text-center">
                        <span
                          className="px-2.5 py-1 rounded-[20px] text-[11px] font-semibold"
                          style={{ backgroundColor: rs.bg, color: rs.text }}
                        >
                          {b.risk}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#111827]">{b.studentName}</td>
                      <td className="px-4 py-3 text-[#374151]">{b.className}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#991B1B]">{overAmount.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-center text-[#374151]">{formatKoreanDate(b.dueDate)}</td>
                      <td className="px-4 py-3 text-[#6b7280]">{b.memo || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button variant="default" size="sm">
                            <Phone size={11} /> 연락
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => payBill(b.id, overAmount, '카드', '2026-04-17')}
                          >
                            수납
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
