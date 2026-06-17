'use client';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { BillStatus } from '@/lib/types/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Send, Phone } from 'lucide-react';
import { RISK_STYLE, getRiskLevel, generateOverdueContent, today } from '../_shared';

export default function OverdueTab({ onOpenDetail }: { onOpenDetail: (studentId: string) => void }) {
  const { bills, payBill, getBillsByStudent } = useFinanceStore();
  const { addNotification } = useCommunicationStore();
  const academyName = useAuthStore((s) => s.currentUser?.academyName) || '학원';

  // ── 미납 알림 발송 상태 ───────────────────────────────
  const [overdueNotifSending, setOverdueNotifSending] = useState(false);

  // ── 미납 관리 탭 계산 ─────────────────────────────────
  const overdueBills = bills
    .filter((b) => b.status !== BillStatus.PAID)
    .map((b) => ({ ...b, risk: getRiskLevel(b) }))
    .sort((a, b) => { const order = ['위험', '주의', '경고']; return order.indexOf(a.risk) - order.indexOf(b.risk); });

  const totalOverdue = overdueBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
  const dangerCount = overdueBills.filter((b) => b.risk === '위험').length;
  const warningCount = overdueBills.filter((b) => b.risk === '주의').length;

  // ── 미납 알림 발송 핸들러 (개별) ──────────────────────
  const sendOverdueNotification = async (studentId: string, studentName: string) => {
    const studentBills = getBillsByStudent(studentId).filter((b) => b.status !== BillStatus.PAID);
    if (studentBills.length === 0) { toast('미납 청구 내역이 없습니다.', 'error'); return; }
    await addNotification({
      type: '수납알림',
      title: `미납 수강료 안내`,
      content: generateOverdueContent(academyName, studentName, studentBills),
      recipients: [studentId],
      sentBy: '',
      billIds: studentBills.map((b) => b.id),
    });
  };

  // ── 미납 알림 일괄 발송 핸들러 ────────────────────────
  const sendBatchOverdueNotifications = async () => {
    if (overdueBills.length === 0) { toast('미납 학생이 없습니다.', 'info'); return; }
    setOverdueNotifSending(true);
    try {
      // 학생별 중복 제거
      const studentMap = new Map<string, { studentId: string; studentName: string }>();
      overdueBills.forEach((b) => {
        if (!studentMap.has(b.studentId)) {
          studentMap.set(b.studentId, { studentId: b.studentId, studentName: b.studentName });
        }
      });

      let successCount = 0;
      let failCount = 0;
      for (const { studentId, studentName } of studentMap.values()) {
        const studentBills = getBillsByStudent(studentId).filter((b) => b.status !== BillStatus.PAID);
        if (studentBills.length === 0) continue;
        try {
          // fetch는 HTTP 4xx/5xx에 reject하지 않으므로 res.ok를 직접 검사해야
          // 서버가 거절한 발송이 '성공'으로 집계되지 않는다.
          const res = await fetch('/api/communication/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: '수납알림',
              title: `미납 수강료 안내`,
              content: generateOverdueContent(academyName, studentName, studentBills),
              recipients: [studentId],
              billIds: studentBills.map((b) => b.id),
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          successCount++;
        } catch { failCount++; }
      }
      if (failCount === 0) {
        toast(`미납 알림 ${successCount}명 발송 완료`, 'success');
      } else if (successCount === 0) {
        toast(`미납 알림 발송 실패 (${failCount}명)`, 'error');
      } else {
        toast(`미납 알림 ${successCount}명 발송 · ${failCount}명 실패`, 'error');
      }
    } catch {
      toast('알림 발송 중 오류가 발생했습니다.', 'error');
    } finally {
      setOverdueNotifSending(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1">
          {[
            { label: '미납 총액', value: `${(totalOverdue / 10000).toFixed(0)}만원`, color: '#991B1B' },
            { label: '위험 (2개월+)', value: `${dangerCount}명`, color: '#991B1B' },
            { label: '주의 (1개월)', value: `${warningCount}명`, color: '#92400E' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
              <div className="text-[22px] font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-[11.5px] text-[#6b7280] mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>
        <div className="ml-3 shrink-0">
          <Button
            variant="default"
            size="sm"
            onClick={sendBatchOverdueNotifications}
            disabled={overdueNotifSending || overdueBills.length === 0}
          >
            <Send size={13} />
            {overdueNotifSending ? '발송 중...' : `미납 알림 일괄 발송 (${[...new Set(overdueBills.map(b => b.studentId))].length}명)`}
          </Button>
        </div>
      </div>
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
                const rs = RISK_STYLE[b.risk] ?? RISK_STYLE['경고'];
                const overAmount = b.amount - b.paidAmount;
                return (
                  <tr key={b.id} className="hover:bg-[#f9fafb]" style={{ borderLeft: `3px solid ${rs.border}` }}>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-1 rounded-[20px] text-[11px] font-semibold" style={{ backgroundColor: rs.bg, color: rs.text }}>{b.risk}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#111827]">{b.studentName}</td>
                    <td className="px-4 py-3 text-[#374151]">{b.className}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold text-[#991B1B]">{overAmount.toLocaleString()}원</span>
                        <button onClick={() => onOpenDetail(b.studentId)} className="text-[11px] text-[#6b7280] border border-[#e2e8f0] rounded-[6px] px-2 py-0.5 hover:bg-[#f9fafb] whitespace-nowrap cursor-pointer">상세 이력</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-[#374151]">{formatKoreanDate(b.dueDate)}</td>
                    <td className="px-4 py-3 text-[#6b7280]">{b.memo || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => sendOverdueNotification(b.studentId, b.studentName)}
                        >
                          <Send size={11} /> 알림
                        </Button>
                        <Button variant="default" size="sm" onClick={() => toast(`${b.studentName} 학부모에게 연락을 시도합니다.`, 'info')}>
                          <Phone size={11} /> 연락
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => payBill(b.id, overAmount, '카드', today)}>수납</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
