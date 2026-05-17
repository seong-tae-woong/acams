'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { BillStatus } from '@/lib/types/finance';
import type { Bill } from '@/lib/types/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Send, Phone } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import SearchInput from '@/components/shared/SearchInput';

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

const STATUS_STYLE: Record<BillStatus, { label: string; bg: string; text: string }> = {
  [BillStatus.PAID]:      { label: '완납',   bg: '#D1FAE5', text: '#065f46' },
  [BillStatus.UNPAID]:    { label: '미납',   bg: '#FEE2E2', text: '#991B1B' },
  [BillStatus.PARTIAL]:   { label: '부분납', bg: '#FEF3C7', text: '#92400E' },
  [BillStatus.CANCELLED]: { label: '취소됨', bg: '#F1F5F9', text: '#6b7280' },
};

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
}

function generateOverdueContent(academyName: string, studentName: string, unpaidBills: Bill[]): string {
  const lines = unpaidBills.map((b) => {
    const due = b.amount - b.paidAmount;
    return `• ${formatMonth(b.month)} | ${b.className} | ${due.toLocaleString()}원`;
  });
  const total = unpaidBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
  return [
    `안녕하세요, ${academyName}입니다.`,
    ``,
    `${studentName} 학부모님, 현재 아래와 같이 수강료가 미납되어 있습니다.`,
    ``,
    `📋 미납 내역`,
    ...lines,
    ``,
    `미납 총액: ${total.toLocaleString()}원`,
    ``,
    `아래 [결제하기] 버튼을 눌러 납부를 진행해 주시기 바랍니다.`,
    `빠른 납부에 감사드립니다.`,
  ].join('\n');
}

export default function OverduePage() {
  const { bills, loading, payBill, getBillsByStudent, fetchBills } = useFinanceStore();
  const academyName = useAuthStore((s) => s.currentUser?.academyName) || '학원';

  const today = new Date().toISOString().split('T')[0];

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [overdueNotifSending, setOverdueNotifSending] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 검색어 디바운스 (~300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // 미납·부분납 청구서만 조회 (월 무관) — 검색어 변경 시 서버 재조회
  useEffect(() => {
    fetchBills(undefined, { status: '미납,부분납', q: debouncedSearch || undefined });
  }, [debouncedSearch, fetchBills]);

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

  const detailBills = detailStudentId
    ? getBillsByStudent(detailStudentId).sort((a, b) => b.month.localeCompare(a.month))
    : [];
  const detailStudentName = detailBills[0]?.studentName ?? '';

  const openDetail = (studentId: string) => {
    setDetailStudentId(studentId);
    setDetailOpen(true);
  };

  // 개별 미납 알림 발송
  const sendOverdueNotification = async (studentId: string, studentName: string) => {
    const studentBills = getBillsByStudent(studentId).filter((b) => b.status !== BillStatus.PAID);
    if (studentBills.length === 0) { toast('미납 청구 내역이 없습니다.', 'error'); return; }
    try {
      const res = await fetch('/api/communication/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: '수납알림',
          title: `미납 수강료 안내`,
          content: generateOverdueContent(academyName, studentName, studentBills),
          recipients: [studentId],
        }),
      });
      if (res.ok) {
        toast(`${studentName}에게 미납 알림을 발송했습니다.`, 'success');
      } else {
        toast('알림 발송에 실패했습니다.', 'error');
      }
    } catch {
      toast('알림 발송 중 오류가 발생했습니다.', 'error');
    }
  };

  // 일괄 미납 알림 발송
  const sendBatchOverdueNotifications = async () => {
    if (overdueBills.length === 0) { toast('미납 학생이 없습니다.', 'info'); return; }
    setOverdueNotifSending(true);
    try {
      const studentMap = new Map<string, { studentId: string; studentName: string }>();
      overdueBills.forEach((b) => {
        if (!studentMap.has(b.studentId)) {
          studentMap.set(b.studentId, { studentId: b.studentId, studentName: b.studentName });
        }
      });

      let successCount = 0;
      for (const { studentId, studentName } of studentMap.values()) {
        const studentBills = getBillsByStudent(studentId).filter((b) => b.status !== BillStatus.PAID);
        if (studentBills.length === 0) continue;
        try {
          const res = await fetch('/api/communication/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: '수납알림',
              title: `미납 수강료 안내`,
              content: generateOverdueContent(academyName, studentName, studentBills),
              recipients: [studentId],
            }),
          });
          if (res.ok) successCount++;
        } catch { /* 개별 실패 무시 */ }
      }
      toast(`미납 알림 ${successCount}명 발송 완료`, 'success');
    } catch {
      toast('알림 발송 중 오류가 발생했습니다.', 'error');
    } finally {
      setOverdueNotifSending(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="미납 관리"
        badge={`미납 ${overdueBills.length}명`}
        actions={
          <Button
            variant="default"
            size="sm"
            onClick={sendBatchOverdueNotifications}
            disabled={overdueNotifSending || overdueBills.length === 0}
          >
            <Send size={13} />
            {overdueNotifSending ? '발송 중...' : `미납 알림 일괄 발송 (${[...new Set(overdueBills.map(b => b.studentId))].length}명)`}
          </Button>
        }
      />
      {loading ? <LoadingSpinner /> : <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-3">
            <span className="text-[12.5px] font-semibold text-[#111827]">미납/부분납 현황</span>
            <SearchInput value={search} onChange={setSearch} placeholder="학생 이름 검색" className="w-40 ml-auto" />
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold text-[#991B1B]">{overAmount.toLocaleString()}원</span>
                          <button
                            onClick={() => openDetail(b.studentId)}
                            className="text-[11px] text-[#6b7280] border border-[#e2e8f0] rounded-[6px] px-2 py-0.5 hover:bg-[#f9fafb] whitespace-nowrap cursor-pointer"
                          >
                            상세 이력
                          </button>
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
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => payBill(b.id, overAmount, '카드', today)}
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
      </div>}

      {/* 수강료 납부 이력 모달 */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`${detailStudentName} 수강료 납부 이력`}
        size="md"
        footer={
          <Button variant="default" size="md" onClick={() => setDetailOpen(false)}>닫기</Button>
        }
      >
        <div className="space-y-1">
          {detailBills.length === 0 ? (
            <div className="text-center text-[13px] text-[#9ca3af] py-6">이력이 없습니다.</div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#f4f6f8]">
                  <th className="text-left px-3 py-2 text-[#6b7280] font-medium rounded-tl-[6px]">청구 월</th>
                  <th className="text-left px-3 py-2 text-[#6b7280] font-medium">반</th>
                  <th className="text-right px-3 py-2 text-[#6b7280] font-medium">청구액</th>
                  <th className="text-right px-3 py-2 text-[#6b7280] font-medium">납부액</th>
                  <th className="text-right px-3 py-2 text-[#6b7280] font-medium">미납액</th>
                  <th className="text-center px-3 py-2 text-[#6b7280] font-medium rounded-tr-[6px]">상태</th>
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
                      <td className="px-3 py-2.5 text-right text-[#111827]">
                        {b.amount.toLocaleString()}원
                        {(b.adjustAmount ?? 0) > 0 && (
                          <div className="text-[11px] text-[#991B1B]">-{(b.adjustAmount ?? 0).toLocaleString()}원 차감</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#111827]">{b.paidAmount.toLocaleString()}원</td>
                      <td className="px-3 py-2.5 text-right font-medium" style={{ color: unpaid > 0 ? '#991B1B' : '#065f46' }}>
                        {unpaid > 0 ? `${unpaid.toLocaleString()}원` : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#f4f6f8] font-semibold">
                  <td className="px-3 py-2 text-[#374151]" colSpan={2}>합계</td>
                  <td className="px-3 py-2 text-right text-[#111827]">
                    {detailBills.reduce((s, b) => s + b.amount, 0).toLocaleString()}원
                  </td>
                  <td className="px-3 py-2 text-right text-[#0D9E7A]">
                    {detailBills.reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}원
                  </td>
                  <td className="px-3 py-2 text-right text-[#991B1B]">
                    {detailBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0).toLocaleString()}원
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
}
