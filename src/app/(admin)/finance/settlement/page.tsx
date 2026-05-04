'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { BillStatus } from '@/lib/types/finance';
import { FileDown, ChevronDown, ChevronUp, Printer, Check } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import { formatKoreanDate } from '@/lib/utils/format';
import clsx from 'clsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const today = new Date().toISOString().split('T')[0];
const currentMonth = today.slice(0, 7);

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
}

const RECEIPT_METHOD_STYLE: Record<string, { bg: string; text: string }> = {
  '카드':    { bg: '#DBEAFE', text: '#1d4ed8' },
  '계좌이체': { bg: '#E1F5EE', text: '#065f46' },
  '현금':    { bg: '#FEF3C7', text: '#92400E' },
};

const SETTLEMENT_TABS = [
  { value: 'settlement', label: '매출/지출 정산' },
  { value: 'receipts',   label: '영수증 이력' },
];

export default function SettlementPage() {
  const {
    bills, loading, expenses, receipts,
    fetchBills, fetchExpenses, fetchReceipts,
    fetchAvailableMonths, fetchAvailableReceiptMonths,
    availableMonths, availableReceiptMonths,
  } = useFinanceStore();
  const [settlementTab, setSettlementTab] = useState('settlement');

  useEffect(() => {
    fetchAvailableMonths();
    fetchAvailableReceiptMonths();
    fetchBills();
    fetchExpenses();
    fetchReceipts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 정산 탭 ── */

  const [selectedMonth, setSelectedMonth] = useState(
    availableMonths.includes(currentMonth) ? currentMonth : (availableMonths[0] ?? currentMonth)
  );

  const totalRevenue = bills
    .filter((b) => b.month === selectedMonth && b.status !== BillStatus.UNPAID)
    .reduce((s, b) => s + b.paidAmount, 0);

  const totalExpense = expenses
    .filter((e) => e.date.slice(0, 7) === selectedMonth)
    .reduce((s, e) => s + e.amount, 0);
  const netIncome = totalRevenue - totalExpense;

  const revenueByClass: Record<string, number> = {};
  bills
    .filter((b) => b.month === selectedMonth && b.status !== BillStatus.UNPAID)
    .forEach((b) => { revenueByClass[b.className] = (revenueByClass[b.className] ?? 0) + b.paidAmount; });

  const expenseByCategory: Record<string, number> = {};
  expenses
    .filter((e) => e.date.slice(0, 7) === selectedMonth)
    .forEach((e) => { expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount; });

  const selectedExpenses = expenses.filter((e) => e.date.slice(0, 7) === selectedMonth);

  const chartMonths = useMemo(() => {
    const months = new Set<string>();
    bills.forEach((b) => months.add(b.month));
    expenses.forEach((e) => months.add(e.date.slice(0, 7)));
    return Array.from(months).sort();
  }, [bills, expenses]);

  const chartData = chartMonths.map((m) => {
    const rev = bills
      .filter((b) => b.month === m && b.status !== BillStatus.UNPAID)
      .reduce((s, b) => s + b.paidAmount, 0);
    const exp = expenses
      .filter((e) => e.date.slice(0, 7) === m)
      .reduce((s, e) => s + e.amount, 0);
    return { month: formatMonth(m), revenue: rev, expense: exp };
  });

  /* ── 영수증 탭 ── */
  const [rcptSearch, setRcptSearch] = useState('');
  const [rcptFilterMonths, setRcptFilterMonths] = useState<string[]>([currentMonth]);
  const [rcptMonthDropOpen, setRcptMonthDropOpen] = useState(false);
  const rcptMonthDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rcptMonthDropRef.current && !rcptMonthDropRef.current.contains(e.target as Node)) {
        setRcptMonthDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleRcptMonth = (m: string) => {
    const next = rcptFilterMonths.includes(m) ? rcptFilterMonths.filter((x) => x !== m) : [...rcptFilterMonths, m];
    setRcptFilterMonths(next);
    if (next.length === 1) fetchReceipts(next[0]);
    else fetchReceipts();
  };

  const rcptMonthLabel =
    rcptFilterMonths.length === 0
      ? '전체 월'
      : rcptFilterMonths.length === 1
        ? formatMonth(rcptFilterMonths[0])
        : `${formatMonth([...rcptFilterMonths].sort().reverse()[0])} 외 ${rcptFilterMonths.length - 1}개`;

  const filteredReceipts = receipts.filter((r) => {
    if (rcptFilterMonths.length > 0 && !rcptFilterMonths.includes(r.issuedDate.slice(0, 7))) return false;
    if (rcptSearch && !r.studentName.includes(rcptSearch)) return false;
    return true;
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="정산 및 영수증"
        actions={
          settlementTab === 'settlement' ? (
            <>
              <div className="flex items-center gap-1.5 border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 bg-white">
                <button
                  className="text-[#6b7280] hover:text-[#111827] cursor-pointer"
                  onClick={() => {
                    const idx = availableMonths.indexOf(selectedMonth);
                    if (idx < availableMonths.length - 1) setSelectedMonth(availableMonths[idx + 1]);
                  }}
                >
                  <ChevronDown size={13} />
                </button>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-[12.5px] text-[#111827] font-medium focus:outline-none cursor-pointer bg-transparent"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>{formatMonth(m)}</option>
                  ))}
                </select>
                <button
                  className="text-[#6b7280] hover:text-[#111827] cursor-pointer"
                  onClick={() => {
                    const idx = availableMonths.indexOf(selectedMonth);
                    if (idx > 0) setSelectedMonth(availableMonths[idx - 1]);
                  }}
                >
                  <ChevronUp size={13} />
                </button>
              </div>
              <Button variant="default" size="sm" onClick={() => toast('정산서가 다운로드됩니다. (추후 연동 예정)', 'info')}>
                <FileDown size={13} /> 정산서 내보내기
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" onClick={() => toast('영수증 목록을 CSV로 내보냅니다. (추후 연동 예정)', 'info')}>
              <FileDown size={13} /> 전체 내보내기
            </Button>
          )
        }
      />

      <Tabs tabs={SETTLEMENT_TABS} value={settlementTab} onChange={setSettlementTab} />

      {loading ? <LoadingSpinner /> : (
        <>
          {/* 매출/지출 정산 탭 */}
          {settlementTab === 'settlement' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                  <div className="text-[22px] font-bold text-[#0D9E7A]">{(totalRevenue / 10000).toFixed(0)}만원</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-1">총 수입</div>
                </div>
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                  <div className="text-[22px] font-bold text-[#991B1B]">{(totalExpense / 10000).toFixed(0)}만원</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-1">총 지출</div>
                </div>
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                  <div className="text-[22px] font-bold" style={{ color: netIncome >= 0 ? '#0D9E7A' : '#991B1B' }}>
                    {netIncome >= 0 ? '+' : ''}{(netIncome / 10000).toFixed(0)}만원
                  </div>
                  <div className="text-[11.5px] text-[#6b7280] mt-1">순이익</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">월별 매출/지출 추이</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${((v as number) / 10000).toFixed(0)}만`} />
                      <Tooltip formatter={(v) => `${(v as number).toLocaleString()}원`} contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenue" name="수입" fill="#4fc3a1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="지출" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">지출 카테고리</div>
                  {Object.keys(expenseByCategory).length === 0 ? (
                    <div className="text-center text-[12px] text-[#9ca3af] py-4">해당 월 지출 없음</div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(expenseByCategory).map(([cat, amt]) => {
                        const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-[12px] mb-1">
                              <span className="text-[#374151]">{cat}</span>
                              <span className="font-medium text-[#111827]">{amt.toLocaleString()}원 ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#f87171]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0]">
                  <span className="text-[12.5px] font-semibold text-[#111827]">반별 수입 내역</span>
                </div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f4f6f8]">
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">반</th>
                      <th className="text-right px-4 py-2.5 text-[#6b7280] font-medium">수납액</th>
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">비율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {Object.keys(revenueByClass).length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-[#9ca3af]">해당 월 수입 없음</td></tr>
                    ) : (
                      Object.entries(revenueByClass).map(([cls, amt]) => {
                        const pct = totalRevenue > 0 ? Math.round((amt / totalRevenue) * 100) : 0;
                        return (
                          <tr key={cls} className="hover:bg-[#f9fafb]">
                            <td className="px-4 py-3 text-[#111827]">{cls}</td>
                            <td className="px-4 py-3 text-right font-medium text-[#111827]">{amt.toLocaleString()}원</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-[#4fc3a1]" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[11px] text-[#6b7280] w-8 text-right">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0]">
                  <span className="text-[12.5px] font-semibold text-[#111827]">지출 상세 내역</span>
                </div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f4f6f8]">
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">날짜</th>
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">항목</th>
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">카테고리</th>
                      <th className="text-right px-4 py-2.5 text-[#6b7280] font-medium">금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {selectedExpenses.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-[#9ca3af]">해당 월 지출 없음</td></tr>
                    ) : (
                      selectedExpenses.map((e) => (
                        <tr key={e.id} className="hover:bg-[#f9fafb]">
                          <td className="px-4 py-3 text-[#6b7280]">{e.date}</td>
                          <td className="px-4 py-3 text-[#111827]">{e.description}</td>
                          <td className="px-4 py-3 text-[#374151]">{e.category}</td>
                          <td className="px-4 py-3 text-right font-medium text-[#111827]">{e.amount.toLocaleString()}원</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 영수증 이력 탭 */}
          {settlementTab === 'receipts' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    placeholder="학생 이름 검색"
                    value={rcptSearch}
                    onChange={(e) => setRcptSearch(e.target.value)}
                    className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-1.5 w-40 focus:outline-none focus:border-[#4fc3a1]"
                  />
                  <div className="relative" ref={rcptMonthDropRef}>
                    <button
                      type="button"
                      onClick={() => setRcptMonthDropOpen((v) => !v)}
                      className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 flex items-center gap-1.5 focus:outline-none cursor-pointer hover:bg-[#f9fafb] bg-white whitespace-nowrap"
                    >
                      <span>{rcptMonthLabel}</span>
                      <ChevronDown size={12} className={clsx('text-[#6b7280] transition-transform', rcptMonthDropOpen && 'rotate-180')} />
                    </button>
                    {rcptMonthDropOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-10 min-w-[140px] py-1">
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#6b7280]"
                          onClick={() => setRcptFilterMonths([])}
                        >
                          <Check size={12} className={clsx(rcptFilterMonths.length === 0 ? 'text-[#4fc3a1]' : 'invisible')} />
                          전체 월
                        </div>
                        <div className="border-t border-[#f1f5f9] my-1" />
                        {availableReceiptMonths.map((m) => (
                          <div
                            key={m}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#374151]"
                            onClick={() => toggleRcptMonth(m)}
                          >
                            <Check size={12} className={clsx(rcptFilterMonths.includes(m) ? 'text-[#4fc3a1]' : 'invisible')} />
                            {formatMonth(m)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[12px] text-[#6b7280] ml-auto">{filteredReceipts.length}건</span>
                </div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f4f6f8]">
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">영수증 번호</th>
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">학생</th>
                      <th className="text-right px-4 py-2.5 text-[#6b7280] font-medium">금액</th>
                      <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">납부 방법</th>
                      <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">발급일</th>
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">메모</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {filteredReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#9ca3af]">해당 월 영수증이 없습니다</td>
                      </tr>
                    ) : (
                      filteredReceipts.map((r) => {
                        const ms = RECEIPT_METHOD_STYLE[r.method] ?? { bg: '#f1f5f9', text: '#6b7280' };
                        return (
                          <tr key={r.id} className="hover:bg-[#f9fafb]">
                            <td className="px-4 py-3 text-[#9ca3af] font-mono text-[11.5px]">{r.id.toUpperCase()}</td>
                            <td className="px-4 py-3 font-medium text-[#111827]">{r.studentName}</td>
                            <td className="px-4 py-3 text-right font-semibold text-[#111827]">{r.amount.toLocaleString()}원</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className="px-2.5 py-0.5 rounded-[20px] text-[11px] font-medium"
                                style={{ backgroundColor: ms.bg, color: ms.text }}
                              >
                                {r.method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-[#374151]">{formatKoreanDate(r.issuedDate)}</td>
                            <td className="px-4 py-3 text-[#6b7280]">{r.memo || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <Button variant="default" size="sm" onClick={() => toast(`영수증 ${r.id.toUpperCase()} 출력 중...`, 'info')}>
                                <Printer size={12} /> 출력
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
