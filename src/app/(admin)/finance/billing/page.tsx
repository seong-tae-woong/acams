'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { BillStatus } from '@/lib/types/finance';
import type { Bill, PaymentMethod } from '@/lib/types/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Send, ChevronDown, Check, Pencil, Phone } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import clsx from 'clsx';

function generateBillingContent(studentName: string, bills: Bill[], monthStr: string): string {
  const lines = bills.map((b) => {
    const effectiveAmt = b.amount - (b.adjustAmount ?? 0);
    return `• ${b.className} | ${effectiveAmt.toLocaleString()}원${b.adjustMemo ? ` (${b.adjustMemo})` : ''}`;
  });
  const total = bills.reduce((s, b) => s + b.amount - (b.adjustAmount ?? 0), 0);
  return [
    `안녕하세요, 세계로학원입니다.`,
    ``,
    `${studentName} 학부모님, ${monthStr} 수강료가 청구되었습니다.`,
    ``,
    `📋 반별 청구 내역`,
    ...lines,
    ``,
    `청구 총액: ${total.toLocaleString()}원`,
    ``,
    `아래 [결제하기] 버튼을 눌러 납부를 진행해 주시기 바랍니다.`,
    `납부 기한을 확인하신 후 기한 내 납부해 주시기 바랍니다.`,
    ``,
    `감사합니다.`,
  ].join('\n');
}

const STATUS_STYLE: Record<BillStatus, { label: string; bg: string; text: string }> = {
  [BillStatus.PAID]:    { label: '완납', bg: '#D1FAE5', text: '#065f46' },
  [BillStatus.UNPAID]:  { label: '미납', bg: '#FEE2E2', text: '#991B1B' },
  [BillStatus.PARTIAL]: { label: '부분납', bg: '#FEF3C7', text: '#92400E' },
};

const METHOD_STYLE: Record<string, { bg: string; text: string }> = {
  '카드':    { bg: '#DBEAFE', text: '#1d4ed8' },
  '계좌이체': { bg: '#E1F5EE', text: '#065f46' },
  '현금':    { bg: '#FEF3C7', text: '#92400E' },
};

const RISK_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  '위험': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  '주의': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  '경고': { bg: '#DBEAFE', text: '#1d4ed8', border: '#BFDBFE' },
};

function getRiskLevel(bill: { status: BillStatus; memo: string }) {
  if (bill.memo.includes('2개월') || bill.memo.includes('3월도')) return '위험';
  if (bill.status === BillStatus.UNPAID) return '주의';
  return '경고';
}

const today = new Date().toISOString().split('T')[0];
const currentMonth = today.slice(0, 7);

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
}

function generateOverdueContent(studentName: string, unpaidBills: Bill[]): string {
  const lines = unpaidBills.map((b) => {
    const due = b.amount - b.paidAmount;
    return `• ${formatMonth(b.month)} | ${b.className} | ${due.toLocaleString()}원`;
  });
  const total = unpaidBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
  return [
    `안녕하세요, 세계로학원입니다.`,
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

const FINANCE_TABS = [
  { value: 'billing', label: '청구 및 수납' },
  { value: 'payments', label: '수납 내역' },
  { value: 'overdue', label: '미납 관리' },
];

export default function BillingPage() {
  const {
    bills, paidBillsView, loading,
    payBill, adjustBill, getBillsByStudent,
    fetchBills, fetchPaidBills,
    fetchAvailableMonths, fetchAvailablePaidMonths,
    availableMonths, availablePaidMonths,
  } = useFinanceStore();
  const { classes, fetchClasses } = useClassStore();
  const { addNotification } = useCommunicationStore();

  useEffect(() => {
    fetchAvailableMonths();
    fetchAvailablePaidMonths();
    fetchBills();
    fetchPaidBills();
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 탭 ──────────────────────────────────────────────
  const [financeTab, setFinanceTab] = useState('billing');

  // ── 청구 탭 상태 ──────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<BillStatus | 'all'>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterMonths, setFilterMonths] = useState<string[]>([currentMonth]);
  const [monthDropOpen, setMonthDropOpen] = useState(false);
  const [search, setSearch] = useState('');
  const monthDropRef = useRef<HTMLDivElement>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('카드');
  const [payDate, setPayDate] = useState(today);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Bill | null>(null);
  const [adjustAmt, setAdjustAmt] = useState('');
  const [adjustMemoVal, setAdjustMemoVal] = useState('');

  // ── 청구서 발송 모달 상태 ─────────────────────────────
  const [billingNotifOpen, setBillingNotifOpen] = useState(false);
  const [billingNotifSending, setBillingNotifSending] = useState(false);

  // ── 다중 선택 상태 ────────────────────────────────────
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());

  // ── 미납 알림 발송 상태 ───────────────────────────────
  const [overdueNotifSending, setOverdueNotifSending] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (monthDropRef.current && !monthDropRef.current.contains(e.target as Node)) setMonthDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── 수납 내역 탭 상태 ─────────────────────────────────
  const [payViewMode, setPayViewMode] = useState<'all' | 'card' | 'transfer' | 'cash'>('all');
  const [payFilterMonths2, setPayFilterMonths2] = useState<string[]>([currentMonth]);
  const [payMonthDropOpen2, setPayMonthDropOpen2] = useState(false);
  const payMonthDropRef2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (payMonthDropRef2.current && !payMonthDropRef2.current.contains(e.target as Node)) setPayMonthDropOpen2(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── 미납 관리 탭 상태 ─────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

  // ── 청구 탭 계산 ──────────────────────────────────────
  const toggleMonth = (m: string) => {
    const next = filterMonths.includes(m) ? filterMonths.filter((x) => x !== m) : [...filterMonths, m];
    setFilterMonths(next);
    if (next.length === 1) fetchBills(next[0]);
    else fetchBills(); // 전체 월 or 복수 선택 시 전체 조회
  };

  const monthLabel = filterMonths.length === 0 ? '전체 월'
    : filterMonths.length === 1 ? formatMonth(filterMonths[0])
    : `${formatMonth([...filterMonths].sort().reverse()[0])} 외 ${filterMonths.length - 1}개`;

  const monthFilteredBills = filterMonths.length === 0 ? bills : bills.filter((b) => filterMonths.includes(b.month));
  const totalBilled = monthFilteredBills.reduce((s, b) => s + b.amount, 0);
  const totalPaid = monthFilteredBills.reduce((s, b) => s + b.paidAmount, 0);
  const totalUnpaid = totalBilled - totalPaid;
  const rate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
  const filtered = monthFilteredBills.filter((b) => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (filterClass !== 'all' && b.classId !== filterClass) return false;
    if (search && !b.studentName.includes(search)) return false;
    return true;
  });
  const unpaidBills = monthFilteredBills.filter((b) => b.status !== BillStatus.PAID);

  // ── 수납 내역 탭 계산 ─────────────────────────────────
  const togglePayMonth = (m: string) => {
    const next = payFilterMonths2.includes(m) ? payFilterMonths2.filter((x) => x !== m) : [...payFilterMonths2, m];
    setPayFilterMonths2(next);
    if (next.length === 1) fetchPaidBills(next[0]);
    else fetchPaidBills();
  };
  const payMonthLabel2 = payFilterMonths2.length === 0 ? '전체 월'
    : payFilterMonths2.length === 1 ? formatMonth(payFilterMonths2[0])
    : `${formatMonth([...payFilterMonths2].sort().reverse()[0])} 외 ${payFilterMonths2.length - 1}개`;

  const paidBills = paidBillsView.filter((b) => {
    if (b.status === BillStatus.UNPAID || !b.paidDate) return false;
    if (payFilterMonths2.length > 0 && !payFilterMonths2.includes(b.paidDate.slice(0, 7))) return false;
    return true;
  }).sort((a, b) => (b.paidDate ?? '').localeCompare(a.paidDate ?? ''));

  const payFiltered = paidBills.filter((b) => {
    if (payViewMode === 'card') return b.method === '카드';
    if (payViewMode === 'transfer') return b.method === '계좌이체';
    if (payViewMode === 'cash') return b.method === '현금';
    return true;
  });

  const totalCard = paidBills.filter((b) => b.method === '카드').reduce((s, b) => s + b.paidAmount, 0);
  const totalTransfer = paidBills.filter((b) => b.method === '계좌이체').reduce((s, b) => s + b.paidAmount, 0);
  const totalCash = paidBills.filter((b) => b.method === '현금').reduce((s, b) => s + b.paidAmount, 0);
  const totalAll = totalCard + totalTransfer + totalCash;

  const byDate: Record<string, typeof paidBills> = {};
  payFiltered.forEach((b) => { const d = b.paidDate ?? ''; if (!byDate[d]) byDate[d] = []; byDate[d].push(b); });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  // ── 미납 관리 탭 계산 ─────────────────────────────────
  const overdueBills = bills
    .filter((b) => b.status !== BillStatus.PAID)
    .map((b) => ({ ...b, risk: getRiskLevel(b) }))
    .sort((a, b) => { const order = ['위험', '주의', '경고']; return order.indexOf(a.risk) - order.indexOf(b.risk); });

  const totalOverdue = overdueBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
  const dangerCount = overdueBills.filter((b) => b.risk === '위험').length;
  const warningCount = overdueBills.filter((b) => b.risk === '주의').length;

  const detailBills = detailStudentId
    ? getBillsByStudent(detailStudentId).sort((a, b) => b.month.localeCompare(a.month))
    : [];
  const detailStudentName = detailBills[0]?.studentName ?? '';

  // ── 다중 선택 핸들러 ──────────────────────────────────
  const toggleBill = (id: string) => setSelectedBillIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const isAllSelected = filtered.length > 0 && filtered.every((b) => selectedBillIds.has(b.id));
  const isSomeSelected = filtered.some((b) => selectedBillIds.has(b.id)) && !isAllSelected;
  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedBillIds((prev) => { const next = new Set(prev); filtered.forEach((b) => next.delete(b.id)); return next; });
    } else {
      setSelectedBillIds((prev) => { const next = new Set(prev); filtered.forEach((b) => next.add(b.id)); return next; });
    }
  };

  // ── 청구 탭 핸들러 ────────────────────────────────────
  const openPay = (b: Bill) => {
    const effectiveAmount = b.amount - (b.adjustAmount ?? 0);
    setPayTarget(b); setPayAmount(String(effectiveAmount - b.paidAmount)); setPayMethod('카드'); setPayDate(today); setPayOpen(true);
  };
  const handlePay = () => {
    if (!payTarget) return;
    const amount = Number(payAmount);
    const effectiveAmount = payTarget.amount - (payTarget.adjustAmount ?? 0);
    if (!amount || amount <= 0) { toast('수납 금액을 입력해주세요.', 'error'); return; }
    if (amount > effectiveAmount - payTarget.paidAmount) { toast('수납액이 잔여 금액을 초과합니다.', 'error'); return; }
    payBill(payTarget.id, amount, payMethod, payDate);
    toast(`${payTarget.studentName} 수납 처리 완료 (${amount.toLocaleString()}원)`);
    setPayOpen(false);
  };
  const openAdjust = (b: Bill) => { setAdjustTarget(b); setAdjustAmt(String(b.adjustAmount ?? '')); setAdjustMemoVal(b.adjustMemo ?? ''); setAdjustOpen(true); };
  const handleAdjust = () => {
    if (!adjustTarget) return;
    const amt = Number(adjustAmt || 0);
    if (amt < 0) { toast('차감 금액은 0 이상이어야 합니다.', 'error'); return; }
    if (amt >= adjustTarget.amount) { toast('차감 금액이 청구액 이상일 수 없습니다.', 'error'); return; }
    adjustBill(adjustTarget.id, amt, adjustMemoVal);
    toast(`조정 저장 완료 (차감 ${amt.toLocaleString()}원)`);
    setAdjustOpen(false);
  };

  // ── 청구서 발송 핸들러 ────────────────────────────────
  const handleSendBillingNotif = async () => {
    setBillingNotifSending(true);
    try {
      for (const { studentId, studentName, bills } of billingNotifTargets) {
        await addNotification({
          type: '수납알림',
          title: `${monthLabel} 수강료 청구 안내`,
          content: generateBillingContent(studentName, bills, monthLabel),
          recipients: [studentId],
          sentBy: '',
          billIds: bills.map((b) => b.id),
        });
      }
      toast(`${billingNotifTargets.length}명에게 청구서를 발송했습니다.`, 'success');
      setSelectedBillIds(new Set());
      setBillingNotifOpen(false);
    } finally {
      setBillingNotifSending(false);
    }
  };

  // ── 미납 알림 발송 핸들러 (개별) ──────────────────────
  const sendOverdueNotification = async (studentId: string, studentName: string) => {
    const studentBills = getBillsByStudent(studentId).filter((b) => b.status !== BillStatus.PAID);
    if (studentBills.length === 0) { toast('미납 청구 내역이 없습니다.', 'error'); return; }
    await addNotification({
      type: '수납알림',
      title: `미납 수강료 안내`,
      content: generateOverdueContent(studentName, studentBills),
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
      for (const { studentId, studentName } of studentMap.values()) {
        const studentBills = getBillsByStudent(studentId).filter((b) => b.status !== BillStatus.PAID);
        if (studentBills.length === 0) continue;
        try {
          await fetch('/api/communication/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: '수납알림',
              title: `미납 수강료 안내`,
              content: generateOverdueContent(studentName, studentBills),
              recipients: [studentId],
              billIds: studentBills.map((b) => b.id),
            }),
          });
          successCount++;
        } catch { /* 개별 실패 무시 */ }
      }
      toast(`미납 알림 ${successCount}명 발송 완료`, 'success');
    } catch {
      toast('알림 발송 중 오류가 발생했습니다.', 'error');
    } finally {
      setOverdueNotifSending(false);
    }
  };

  const fieldClass = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  // 청구서 발송 모달 - 선택된 학생별 청구 목록
  const billingNotifTargets = useMemo(() => {
    const selectedBills = filtered.filter((b) => selectedBillIds.has(b.id));
    const studentMap = new Map<string, { studentId: string; studentName: string; bills: Bill[]; total: number }>();
    selectedBills.forEach((b) => {
      const effectiveAmt = b.amount - (b.adjustAmount ?? 0);
      const due = effectiveAmt - b.paidAmount;
      if (!studentMap.has(b.studentId)) {
        studentMap.set(b.studentId, { studentId: b.studentId, studentName: b.studentName, bills: [], total: 0 });
      }
      const entry = studentMap.get(b.studentId)!;
      entry.bills.push(b);
      entry.total += due;
    });
    return Array.from(studentMap.values());
  }, [filtered, selectedBillIds]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="청구/수납/미납"
        actions={
          <Button variant="dark" size="sm" onClick={() => toast('청구 등록은 추후 지원 예정입니다.', 'info')}>
            <Plus size={13} /> 청구 등록
          </Button>
        }
      />

      {/* 탭 네비게이션 */}
      <Tabs tabs={FINANCE_TABS} value={financeTab} onChange={setFinanceTab} className="bg-white px-5 shrink-0" />

      {loading ? <LoadingSpinner /> : <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* ── 청구 및 수납 탭 ── */}
        {financeTab === 'billing' && (
          <>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '청구 총액', value: `${(totalBilled / 10000).toFixed(0)}만원`, color: '#111827' },
                { label: '수납 완료', value: `${(totalPaid / 10000).toFixed(0)}만원`, color: '#0D9E7A' },
                { label: '미납 잔액', value: `${(totalUnpaid / 10000).toFixed(0)}만원`, color: '#991B1B' },
                { label: '수납률', value: `${rate}%`, color: '#4fc3a1' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                  <div className="text-[22px] font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-[10px] border border-[#e2e8f0]">
              <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-3 flex-wrap">
                <input type="text" placeholder="학생 이름 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-1.5 w-40 focus:outline-none focus:border-[#4fc3a1]" />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as BillStatus | 'all')} className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none cursor-pointer">
                  <option value="all">전체 상태</option>
                  <option value={BillStatus.PAID}>완납</option>
                  <option value={BillStatus.UNPAID}>미납</option>
                  <option value={BillStatus.PARTIAL}>부분납</option>
                </select>
                <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none cursor-pointer">
                  <option value="all">전체 반</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="relative" ref={monthDropRef}>
                  <button type="button" onClick={() => setMonthDropOpen((v) => !v)} className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 flex items-center gap-1.5 focus:outline-none cursor-pointer hover:bg-[#f9fafb] bg-white whitespace-nowrap">
                    <span>{monthLabel}</span><ChevronDown size={12} className={clsx('text-[#6b7280] transition-transform', monthDropOpen && 'rotate-180')} />
                  </button>
                  {monthDropOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-10 min-w-[140px] py-1">
                      <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#6b7280]" onClick={() => { setFilterMonths([]); fetchBills(); }}>
                        <Check size={12} className={clsx(filterMonths.length === 0 ? 'text-[#4fc3a1]' : 'invisible')} />전체 월
                      </div>
                      <div className="border-t border-[#f1f5f9] my-1" />
                      {availableMonths.map((m) => (
                        <div key={m} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#374151]" onClick={() => toggleMonth(m)}>
                          <Check size={12} className={clsx(filterMonths.includes(m) ? 'text-[#4fc3a1]' : 'invisible')} />{formatMonth(m)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[12px] text-[#6b7280] ml-auto">{filtered.length}건</span>
                {selectedBillIds.size > 0 && (
                  <span className="text-[12px] text-[#4fc3a1] font-medium">{selectedBillIds.size}개 선택됨</span>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (selectedBillIds.size === 0) { toast('학생을 선택하세요.', 'error'); return; }
                    setBillingNotifOpen(true);
                  }}
                >
                  <Send size={13} /> 청구서 발송
                </Button>
              </div>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-[#f4f6f8]">
                    <th className="px-3 py-2.5 text-center w-9">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                        onChange={toggleAll}
                        className="w-3.5 h-3.5 cursor-pointer accent-[#4fc3a1]"
                        title="전체 선택"
                      />
                    </th>
                    {['학생', '반', '청구액', '메모', '납부액', '납부기한', '상태', '납부방법', ''].map((h) => (
                      <th key={h} className={clsx('px-4 py-2.5 text-[#6b7280] font-medium', h === '청구액' || h === '납부액' ? 'text-right' : h === '납부기한' || h === '상태' || h === '납부방법' ? 'text-center' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filtered.map((b) => {
                    const st = STATUS_STYLE[b.status];
                    const adj = b.adjustAmount ?? 0;
                    const isSelected = selectedBillIds.has(b.id);
                    return (
                      <tr key={b.id} className={clsx('hover:bg-[#f9fafb]', isSelected && 'bg-[#f0fdf8]')}>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleBill(b.id)}
                            className="w-3.5 h-3.5 cursor-pointer accent-[#4fc3a1]"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-[#111827]">{b.studentName}</td>
                        <td className="px-4 py-3 text-[#374151]">{b.className}</td>
                        <td className="px-4 py-3 text-right text-[#111827]">
                          <div className="flex items-center justify-end gap-1">
                            <span>{b.amount.toLocaleString()}원</span>
                            <button onClick={() => openAdjust(b)} className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors cursor-pointer" title="조정금액 설정"><Pencil size={11} /></button>
                          </div>
                          {adj > 0 && <div className="text-[11px] text-[#991B1B] mt-0.5">차감 -{adj.toLocaleString()}원</div>}
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <button onClick={() => openAdjust(b)} className="text-left w-full hover:text-[#4fc3a1] transition-colors cursor-pointer" title="메모 수정">
                            {b.adjustMemo ? (
                              <span className="text-[12px] text-[#374151]">{b.adjustMemo}</span>
                            ) : (
                              <span className="text-[11.5px] text-[#d1d5db] italic">메모 추가...</span>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right text-[#111827]">{b.paidAmount.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-center text-[#374151]">{formatKoreanDate(b.dueDate)}</td>
                        <td className="px-4 py-3 text-center"><span className="px-2.5 py-1 rounded-[20px] text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                        <td className="px-4 py-3 text-center text-[#6b7280]">{b.method ?? '-'}</td>
                        <td className="px-4 py-3 text-center">{b.status !== BillStatus.PAID && <Button variant="primary" size="sm" onClick={() => openPay(b)}>수납</Button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {unpaidBills.length > 0 && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] p-4">
                <div className="text-[12.5px] font-semibold text-[#991B1B] mb-2">미납/부분납 학생 {unpaidBills.length}명</div>
                <div className="flex flex-wrap gap-2">
                  {unpaidBills.map((b) => <span key={b.id} className="px-2.5 py-1 bg-white border border-[#FECACA] rounded-[8px] text-[12px] text-[#991B1B]">{b.studentName} ({b.className}) {(b.amount - b.paidAmount).toLocaleString()}원</span>)}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 수납 내역 탭 ── */}
        {financeTab === 'payments' && (
          <>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '전체 수납', value: totalAll, color: '#111827' },
                { label: '카드', value: totalCard, color: '#1d4ed8' },
                { label: '계좌이체', value: totalTransfer, color: '#065f46' },
                { label: '현금', value: totalCash, color: '#92400E' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                  <div className="text-[20px] font-bold" style={{ color: kpi.color }}>{(kpi.value / 10000).toFixed(0)}만원</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-2 flex-wrap">
                {(['all', 'card', 'transfer', 'cash'] as const).map((mode) => {
                  const labels = { all: '전체', card: '카드', transfer: '계좌이체', cash: '현금' };
                  return (
                    <button key={mode} onClick={() => setPayViewMode(mode)}
                      className={clsx('px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer', payViewMode === mode ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]')}
                    >{labels[mode]}</button>
                  );
                })}
                <div className="relative ml-auto" ref={payMonthDropRef2}>
                  <button type="button" onClick={() => setPayMonthDropOpen2((v) => !v)} className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 flex items-center gap-1.5 focus:outline-none cursor-pointer hover:bg-[#f9fafb] bg-white whitespace-nowrap">
                    <span>{payMonthLabel2}</span><ChevronDown size={12} className={clsx('text-[#6b7280] transition-transform', payMonthDropOpen2 && 'rotate-180')} />
                  </button>
                  {payMonthDropOpen2 && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-10 min-w-[140px] py-1">
                      <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#6b7280]" onClick={() => { setPayFilterMonths2([]); fetchPaidBills(); }}>
                        <Check size={12} className={clsx(payFilterMonths2.length === 0 ? 'text-[#4fc3a1]' : 'invisible')} />전체 월
                      </div>
                      <div className="border-t border-[#f1f5f9] my-1" />
                      {availablePaidMonths.map((m) => (
                        <div key={m} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#374151]" onClick={() => togglePayMonth(m)}>
                          <Check size={12} className={clsx(payFilterMonths2.includes(m) ? 'text-[#4fc3a1]' : 'invisible')} />{formatMonth(m)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[12px] text-[#6b7280]">{payFiltered.length}건</span>
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {dates.map((date) => (
                  <div key={date}>
                    <div className="px-4 py-2 bg-[#f9fafb]">
                      <span className="text-[11.5px] font-semibold text-[#374151]">{formatKoreanDate(date)}</span>
                      <span className="ml-2 text-[11px] text-[#9ca3af]">{byDate[date].reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}원</span>
                    </div>
                    {byDate[date].map((b) => {
                      const ms = b.method ? (METHOD_STYLE[b.method] ?? { bg: '#f1f5f9', text: '#6b7280' }) : { bg: '#f1f5f9', text: '#6b7280' };
                      return (
                        <div key={b.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#f9fafb]">
                          <div>
                            <span className="text-[13px] font-medium text-[#111827]">{b.studentName}</span>
                            <span className="ml-2 text-[12px] text-[#6b7280]">{b.className}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {b.method && <span className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium" style={{ backgroundColor: ms.bg, color: ms.text }}>{b.method}</span>}
                            <span className="text-[13px] font-semibold text-[#111827]">{b.paidAmount.toLocaleString()}원</span>
                            {b.status === BillStatus.PARTIAL && <span className="text-[11px] text-[#92400E]">(부분납)</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {dates.length === 0 && <div className="p-8 text-center text-[13px] text-[#9ca3af]">수납 내역이 없습니다</div>}
              </div>
            </div>
          </>
        )}

        {/* ── 미납 관리 탭 ── */}
        {financeTab === 'overdue' && (
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
                              <button onClick={() => { setDetailStudentId(b.studentId); setDetailOpen(true); }} className="text-[11px] text-[#6b7280] border border-[#e2e8f0] rounded-[6px] px-2 py-0.5 hover:bg-[#f9fafb] whitespace-nowrap cursor-pointer">상세 이력</button>
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
        )}

      </div>}

      {/* ── 수납 처리 모달 ── */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="수납 처리" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setPayOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handlePay}>수납 완료</Button></>}
      >
        {payTarget && (
          <div className="space-y-3">
            <div className="p-3 bg-[#f4f6f8] rounded-[8px] text-[12.5px]">
              <div className="font-semibold text-[#111827]">{payTarget.studentName}</div>
              <div className="text-[#6b7280]">{payTarget.className} · 청구 {payTarget.amount.toLocaleString()}원</div>
              {(payTarget.adjustAmount ?? 0) > 0 && <div className="text-[#991B1B] text-[11.5px]">차감 -{(payTarget.adjustAmount ?? 0).toLocaleString()}원{payTarget.adjustMemo && <span className="ml-1 text-[#6b7280]">({payTarget.adjustMemo})</span>}</div>}
              <div className="text-[#991B1B] font-medium">잔여 {(payTarget.amount - (payTarget.adjustAmount ?? 0) - payTarget.paidAmount).toLocaleString()}원</div>
            </div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">수납 금액 *</label><input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={fieldClass} /></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">납부 방법</label><select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className={fieldClass}><option value="카드">카드</option><option value="계좌이체">계좌이체</option><option value="현금">현금</option></select></div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">납부일</label><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={fieldClass} /></div>
          </div>
        )}
      </Modal>

      {/* ── 청구액 조정 모달 ── */}
      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="청구액 조정" size="sm"
        footer={<><Button variant="default" size="md" onClick={() => setAdjustOpen(false)}>취소</Button><Button variant="dark" size="md" onClick={handleAdjust}>저장</Button></>}
      >
        {adjustTarget && (
          <div className="space-y-3">
            <div className="p-3 bg-[#f4f6f8] rounded-[8px] text-[12.5px]"><div className="font-semibold text-[#111827]">{adjustTarget.studentName}</div><div className="text-[#6b7280]">{adjustTarget.className} · 청구액 {adjustTarget.amount.toLocaleString()}원</div></div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">차감 금액</label>
              <input type="number" placeholder="0" value={adjustAmt} onChange={(e) => setAdjustAmt(e.target.value)} className={fieldClass} />
              <div className="text-[11px] text-[#9ca3af] mt-1">실납부액: {(adjustTarget.amount - Number(adjustAmt || 0)).toLocaleString()}원</div>
            </div>
            <div><label className="text-[11.5px] text-[#6b7280] block mb-1">조정 사유</label><input type="text" placeholder="예) 3/15 수업 결석으로 인한 차감" value={adjustMemoVal} onChange={(e) => setAdjustMemoVal(e.target.value)} className={fieldClass} /></div>
          </div>
        )}
      </Modal>

      {/* ── 수강료 납부 이력 모달 (미납 탭) ── */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`${detailStudentName} 수강료 납부 이력`} size="md"
        footer={<Button variant="default" size="md" onClick={() => setDetailOpen(false)}>닫기</Button>}
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

      {/* ── 청구서 발송 확인 모달 ── */}
      <Modal
        open={billingNotifOpen}
        onClose={() => setBillingNotifOpen(false)}
        title="청구서 발송"
        size="md"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setBillingNotifOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleSendBillingNotif} disabled={billingNotifSending}>
              <Send size={13} /> {billingNotifSending ? '발송 중...' : `${billingNotifTargets.length}명에게 발송`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-[#E1F5EE] border border-[#a7f3d0] rounded-[8px] text-[12.5px] text-[#065f46]">
            선택된 <strong>{billingNotifTargets.length}명</strong>에게 반별 청구액이 담긴 수납 알림을 각각 발송합니다.
            여러 반을 수강 중인 학생은 1개의 알림에 반별 금액과 총 합계가 포함됩니다.
          </div>

          <div>
            <div className="text-[11.5px] font-semibold text-[#374151] mb-2">발송 대상 ({billingNotifTargets.length}명)</div>
            <div className="border border-[#e2e8f0] rounded-[8px] overflow-hidden max-h-52 overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#f4f6f8]">
                    <th className="text-left px-3 py-2 text-[#6b7280] font-medium">학생</th>
                    <th className="text-left px-3 py-2 text-[#6b7280] font-medium">수강 반</th>
                    <th className="text-right px-3 py-2 text-[#6b7280] font-medium">청구 총액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {billingNotifTargets.map((t) => (
                    <tr key={t.studentId}>
                      <td className="px-3 py-2 text-[#111827] font-medium">{t.studentName}</td>
                      <td className="px-3 py-2 text-[#6b7280]">{t.bills.map(b => b.className).join(', ')}</td>
                      <td className="px-3 py-2 text-right text-[#0D9E7A] font-semibold">{t.total.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-[11.5px] font-semibold text-[#374151] mb-2">알림 내용 미리보기 (첫 번째 학생 기준)</div>
            <div className="p-3.5 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#374151] leading-relaxed whitespace-pre-line border border-[#e2e8f0]">
              {billingNotifTargets.length > 0
                ? generateBillingContent(billingNotifTargets[0].studentName, billingNotifTargets[0].bills, monthLabel)
                : ''}
            </div>
            <div className="mt-2 flex">
              <div className="px-4 py-2 rounded-[8px] text-[12px] font-semibold text-white cursor-default" style={{ backgroundColor: '#4fc3a1' }}>
                결제하기 (앱에서 활성화)
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
