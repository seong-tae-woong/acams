'use client';
import { useState, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { mockExpenses } from '@/lib/mock/finance';
import { BillStatus } from '@/lib/types/finance';
import { FileDown, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const today = new Date().toISOString().split('T')[0];
const currentMonth = today.slice(0, 7);

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
}

export default function SettlementPage() {
  const { bills } = useFinanceStore();

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    bills.forEach((b) => months.add(b.month));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [bills]);

  const [selectedMonth, setSelectedMonth] = useState(
    availableMonths.includes(currentMonth) ? currentMonth : (availableMonths[0] ?? currentMonth)
  );

  const totalRevenue = bills
    .filter((b) => b.month === selectedMonth && b.status !== BillStatus.UNPAID)
    .reduce((s, b) => s + b.paidAmount, 0);

  const totalExpense = mockExpenses
    .filter((e) => e.date.slice(0, 7) === selectedMonth)
    .reduce((s, e) => s + e.amount, 0);
  const netIncome = totalRevenue - totalExpense;

  // 수입원별 분류
  const revenueByClass: Record<string, number> = {};
  bills
    .filter((b) => b.month === selectedMonth && b.status !== BillStatus.UNPAID)
    .forEach((b) => { revenueByClass[b.className] = (revenueByClass[b.className] ?? 0) + b.paidAmount; });

  // 지출 카테고리별 합계
  const expenseByCategory: Record<string, number> = {};
  mockExpenses
    .filter((e) => e.date.slice(0, 7) === selectedMonth)
    .forEach((e) => { expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount; });

  const selectedExpenses = mockExpenses.filter((e) => e.date.slice(0, 7) === selectedMonth);

  // 월별 차트 데이터 (bills 기반 동적 계산)
  const chartMonths = useMemo(() => {
    const months = new Set<string>();
    bills.forEach((b) => months.add(b.month));
    mockExpenses.forEach((e) => months.add(e.date.slice(0, 7)));
    return Array.from(months).sort();
  }, [bills]);

  const chartData = chartMonths.map((m) => {
    const rev = bills
      .filter((b) => b.month === m && b.status !== BillStatus.UNPAID)
      .reduce((s, b) => s + b.paidAmount, 0);
    const exp = mockExpenses
      .filter((e) => e.date.slice(0, 7) === m)
      .reduce((s, e) => s + e.amount, 0);
    return { month: formatMonth(m), revenue: rev, expense: exp };
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="매출/지출 정산"
        actions={
          <>
            {/* 월 선택 */}
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
        }
      />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 손익 요약 */}
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
          {/* 월별 매출/지출 차트 */}
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

          {/* 지출 카테고리별 */}
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

        {/* 수입 상세 */}
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

        {/* 지출 상세 */}
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
    </div>
  );
}
