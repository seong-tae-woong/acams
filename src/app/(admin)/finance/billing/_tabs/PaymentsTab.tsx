'use client';
import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { BillStatus } from '@/lib/types/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { ChevronDown, Check, X } from 'lucide-react';
import clsx from 'clsx';
import { METHOD_STYLE, formatMonth } from '../_shared';

interface PaymentsTabProps {
  payFilterMonths: string[];
  setPayFilterMonths: Dispatch<SetStateAction<string[]>>;
}

export default function PaymentsTab({ payFilterMonths, setPayFilterMonths }: PaymentsTabProps) {
  const { paidBillsView, availablePaidMonths } = useFinanceStore();

  // ── 수납 내역 탭 상태 ─────────────────────────────────
  const [payViewMode, setPayViewMode] = useState<'all' | 'card' | 'transfer' | 'cash'>('all');
  const [payMonthDropOpen2, setPayMonthDropOpen2] = useState(false);
  const payMonthDropRef2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (payMonthDropRef2.current && !payMonthDropRef2.current.contains(e.target as Node)) setPayMonthDropOpen2(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── 수납 내역 탭 계산 ─────────────────────────────────
  const togglePayMonth = (m: string) => {
    setPayFilterMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };
  const payMonthLabel2 = payFilterMonths.length === 0 ? '전체 월'
    : payFilterMonths.length === 1 ? formatMonth(payFilterMonths[0])
    : `${payFilterMonths.length}개월`;

  const paidBills = paidBillsView.filter((b) => {
    if (b.status === BillStatus.UNPAID || !b.paidDate) return false;
    if (payFilterMonths.length > 0 && !payFilterMonths.includes(b.paidDate.slice(0, 7))) return false;
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

  return (
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
      <div className="bg-white rounded-[10px] border border-[#e2e8f0]">
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
              <div className="absolute top-full right-0 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-10 min-w-[180px] py-1">
                <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#6b7280]" onClick={() => { setPayFilterMonths([]); setPayMonthDropOpen2(false); }}>
                  <Check size={12} className={clsx(payFilterMonths.length === 0 ? 'text-[#4fc3a1]' : 'invisible')} />전체 월
                </div>
                <div className="border-t border-[#f1f5f9] my-1" />
                {availablePaidMonths.map((m) => (
                  <div key={m} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#374151]" onClick={() => { setPayFilterMonths([m]); setPayMonthDropOpen2(false); }}>
                    <input
                      type="checkbox"
                      checked={payFilterMonths.includes(m)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => togglePayMonth(m)}
                      className="w-3.5 h-3.5 cursor-pointer accent-[#4fc3a1]"
                      title="여러 달 선택"
                    />
                    {formatMonth(m)}
                  </div>
                ))}
              </div>
            )}
          </div>
          {payFilterMonths.length >= 2 && (
            <div className="flex items-center gap-1 flex-wrap">
              {[...payFilterMonths].sort().reverse().map((m) => (
                <span key={m} className="inline-flex items-center gap-1 text-[11.5px] bg-[#eef7f3] text-[#0D9E7A] border border-[#cdeee2] rounded-[20px] pl-2 pr-1 py-0.5">
                  {formatMonth(m)}
                  <button type="button" onClick={() => togglePayMonth(m)} className="hover:bg-[#cdeee2] rounded-full p-0.5 cursor-pointer" title="제거">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
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
  );
}
