'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { formatKoreanDate } from '@/lib/utils/format';
import { FileDown, Printer, ChevronDown, Check } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import SearchInput from '@/components/shared/SearchInput';
import { toast } from '@/lib/stores/toastStore';
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

export default function ReceiptsPage() {
  const { receipts, loading, fetchReceipts } = useFinanceStore();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterMonths, setFilterMonths] = useState<string[]>([currentMonth]);
  const [monthDropOpen, setMonthDropOpen] = useState(false);
  const monthDropRef = useRef<HTMLDivElement>(null);

  // 검색어 디바운스 (~300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // 월 선택 / 검색어 변경 시 서버 재조회
  useEffect(() => {
    fetchReceipts(filterMonths, debouncedSearch || undefined);
  }, [filterMonths, debouncedSearch, fetchReceipts]);

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
    receipts.forEach((r) => months.add(r.issuedDate.slice(0, 7)));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [receipts]);

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

  const filtered = receipts.filter((r) => {
    if (filterMonths.length > 0 && !filterMonths.includes(r.issuedDate.slice(0, 7))) return false;
    if (search && !r.studentName.includes(search)) return false;
    return true;
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="수납 영수증 이력"
        actions={
          <Button variant="default" size="sm" onClick={() => toast('영수증 목록을 CSV로 내보냅니다. (추후 연동 예정)', 'info')}>
            <FileDown size={13} /> 전체 내보내기
          </Button>
        }
      />
      {loading ? <LoadingSpinner /> : <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-3 flex-wrap">
            <SearchInput value={search} onChange={setSearch} placeholder="학생 이름 검색" className="w-40" />
            {/* 월 다중 선택 드롭다운 */}
            <div className="relative" ref={monthDropRef}>
              <button
                type="button"
                onClick={() => setMonthDropOpen((v) => !v)}
                className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 flex items-center gap-1.5 focus:outline-none cursor-pointer hover:bg-[#f9fafb] bg-white whitespace-nowrap"
              >
                <span>{monthLabel}</span>
                <ChevronDown size={12} className={clsx('text-[#6b7280] transition-transform', monthDropOpen && 'rotate-180')} />
              </button>
              {monthDropOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-10 min-w-[140px] py-1">
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
            <span className="text-[12px] text-[#6b7280] ml-auto">{filtered.length}건</span>
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#9ca3af]">해당 월 영수증이 없습니다</td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const ms = METHOD_STYLE[r.method] ?? { bg: '#f1f5f9', text: '#6b7280' };
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
      </div>}
    </div>
  );
}
