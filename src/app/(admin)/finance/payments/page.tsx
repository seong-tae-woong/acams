'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { BillStatus } from '@/lib/types/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { ChevronDown, Check } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import clsx from 'clsx';

const METHOD_STYLE: Record<string, { bg: string; text: string }> = {
  '카드':    { bg: '#DBEAFE', text: '#1d4ed8' },
  '계좌이체': { bg: '#E1F5EE', text: '#065f46' },
  '현금':    { bg: '#FEF3C7', text: '#92400E' },
};

const today = new Date().toISOString().split('T')[0];
const currentMonth = today.slice(0, 7);

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
}

export default function PaymentsPage() {
  const { bills, loading, fetchBills } = useFinanceStore();

  useEffect(() => { fetchBills(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [viewMode, setViewMode] = useState<'all' | 'card' | 'transfer' | 'cash'>('all');
  const [filterMonths, setFilterMonths] = useState<string[]>([currentMonth]);
  const [monthDropOpen, setMonthDropOpen] = useState(false);
  const monthDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (monthDropRef.current && !monthDropRef.current.contains(e.target as Node)) {
        setMonthDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    bills.forEach((b) => b.paidDate && months.add(b.paidDate.slice(0, 7)));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [bills]);

  const toggleMonth = (m: string) => {
    setFilterMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const monthLabel =
    filterMonths.length === 0
      ? '전체 월'
      : filterMonths.length === 1
        ? formatMonth(filterMonths[0])
        : `${formatMonth([...filterMonths].sort().reverse()[0])} 외 ${filterMonths.length - 1}개`;

  const paidBills = bills
    .filter((b) => {
      if (b.status === BillStatus.UNPAID || !b.paidDate) return false;
      if (filterMonths.length > 0 && !filterMonths.includes(b.paidDate.slice(0, 7))) return false;
      return true;
    })
    .sort((a, b) => (b.paidDate ?? '').localeCompare(a.paidDate ?? ''));

  const filtered = paidBills.filter((b) => {
    if (viewMode === 'all') return true;
    if (viewMode === 'card') return b.method === '카드';
    if (viewMode === 'transfer') return b.method === '계좌이체';
    if (viewMode === 'cash') return b.method === '현금';
    return true;
  });

  const totalCard = paidBills.filter((b) => b.method === '카드').reduce((s, b) => s + b.paidAmount, 0);
  const totalTransfer = paidBills.filter((b) => b.method === '계좌이체').reduce((s, b) => s + b.paidAmount, 0);
  const totalCash = paidBills.filter((b) => b.method === '현금').reduce((s, b) => s + b.paidAmount, 0);
  const totalAll = totalCard + totalTransfer + totalCash;

  // 일별 그룹핑
  const byDate: Record<string, typeof paidBills> = {};
  filtered.forEach((b) => {
    const d = b.paidDate ?? '';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(b);
  });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="수납 관리" />
      {loading ? <LoadingSpinner /> : <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 수납 방법별 KPI */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '전체 수납', value: totalAll, color: '#111827' },
            { label: '카드', value: totalCard, color: '#1d4ed8' },
            { label: '계좌이체', value: totalTransfer, color: '#065f46' },
            { label: '현금', value: totalCash, color: '#92400E' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
              <div className="text-[20px] font-bold" style={{ color: kpi.color }}>
                {(kpi.value / 10000).toFixed(0)}만원
              </div>
              <div className="text-[11.5px] text-[#6b7280] mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* 필터 탭 + 월 선택 */}
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-2 flex-wrap">
            {(['all', 'card', 'transfer', 'cash'] as const).map((mode) => {
              const labels = { all: '전체', card: '카드', transfer: '계좌이체', cash: '현금' };
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={clsx(
                    'px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer',
                    viewMode === mode ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]',
                  )}
                >
                  {labels[mode]}
                </button>
              );
            })}

            {/* 월 다중 선택 드롭다운 */}
            <div className="relative ml-auto" ref={monthDropRef}>
              <button
                type="button"
                onClick={() => setMonthDropOpen((v) => !v)}
                className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 flex items-center gap-1.5 focus:outline-none cursor-pointer hover:bg-[#f9fafb] bg-white whitespace-nowrap"
              >
                <span>{monthLabel}</span>
                <ChevronDown size={12} className={clsx('text-[#6b7280] transition-transform', monthDropOpen && 'rotate-180')} />
              </button>
              {monthDropOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-10 min-w-[140px] py-1">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#6b7280]"
                    onClick={() => setFilterMonths([])}
                  >
                    <Check size={12} className={clsx(filterMonths.length === 0 ? 'text-[#4fc3a1]' : 'invisible')} />
                    전체 월
                  </div>
                  <div className="border-t border-[#f1f5f9] my-1" />
                  {availableMonths.map((m) => (
                    <div
                      key={m}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#374151]"
                      onClick={() => toggleMonth(m)}
                    >
                      <Check size={12} className={clsx(filterMonths.includes(m) ? 'text-[#4fc3a1]' : 'invisible')} />
                      {formatMonth(m)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <span className="text-[12px] text-[#6b7280]">{filtered.length}건</span>
          </div>

          {/* 일별 목록 */}
          <div className="divide-y divide-[#f1f5f9]">
            {dates.map((date) => (
              <div key={date}>
                <div className="px-4 py-2 bg-[#f9fafb]">
                  <span className="text-[11.5px] font-semibold text-[#374151]">{formatKoreanDate(date)}</span>
                  <span className="ml-2 text-[11px] text-[#9ca3af]">
                    {byDate[date].reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}원
                  </span>
                </div>
                {byDate[date].map((b) => {
                  const ms = b.method ? METHOD_STYLE[b.method] : { bg: '#f1f5f9', text: '#6b7280' };
                  return (
                    <div key={b.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#f9fafb]">
                      <div>
                        <span className="text-[13px] font-medium text-[#111827]">{b.studentName}</span>
                        <span className="ml-2 text-[12px] text-[#6b7280]">{b.className}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {b.method && (
                          <span
                            className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium"
                            style={{ backgroundColor: ms.bg, color: ms.text }}
                          >
                            {b.method}
                          </span>
                        )}
                        <span className="text-[13px] font-semibold text-[#111827]">
                          {b.paidAmount.toLocaleString()}원
                        </span>
                        {b.status === BillStatus.PARTIAL && (
                          <span className="text-[11px] text-[#92400E]">(부분납)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {dates.length === 0 && (
              <div className="p-8 text-center text-[13px] text-[#9ca3af]">수납 내역이 없습니다</div>
            )}
          </div>
        </div>
      </div>}
    </div>
  );
}
