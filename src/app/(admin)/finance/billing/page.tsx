'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { useClassStore } from '@/lib/stores/classStore';
import { BillStatus } from '@/lib/types/finance';
import type { Bill, PaymentMethod } from '@/lib/types/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Send, ChevronDown, Check, Pencil } from 'lucide-react';
import clsx from 'clsx';

const STATUS_STYLE: Record<BillStatus, { label: string; bg: string; text: string }> = {
  [BillStatus.PAID]:    { label: '완납', bg: '#D1FAE5', text: '#065f46' },
  [BillStatus.UNPAID]:  { label: '미납', bg: '#FEE2E2', text: '#991B1B' },
  [BillStatus.PARTIAL]: { label: '부분납', bg: '#FEF3C7', text: '#92400E' },
};

const today = new Date().toISOString().split('T')[0];
const currentMonth = today.slice(0, 7);

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
}

export default function BillingPage() {
  const { bills, payBill, adjustBill } = useFinanceStore();
  const { classes } = useClassStore();
  const [filterStatus, setFilterStatus] = useState<BillStatus | 'all'>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterMonths, setFilterMonths] = useState<string[]>([currentMonth]);
  const [monthDropOpen, setMonthDropOpen] = useState(false);
  const [search, setSearch] = useState('');
  const monthDropRef = useRef<HTMLDivElement>(null);

  // 수납 처리 모달
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('카드');
  const [payDate, setPayDate] = useState(today);

  // 조정 모달
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Bill | null>(null);
  const [adjustAmt, setAdjustAmt] = useState('');
  const [adjustMemoVal, setAdjustMemoVal] = useState('');

  // 드롭다운 외부 클릭 닫기
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
    bills.forEach((b) => months.add(b.month));
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

  const monthFilteredBills = filterMonths.length === 0
    ? bills
    : bills.filter((b) => filterMonths.includes(b.month));

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

  const unpaidBills = monthFilteredBills.filter((b) => b.status === BillStatus.UNPAID);

  const openPay = (b: Bill) => {
    const effectiveAmount = b.amount - (b.adjustAmount ?? 0);
    setPayTarget(b);
    setPayAmount(String(effectiveAmount - b.paidAmount));
    setPayMethod('카드');
    setPayDate(today);
    setPayOpen(true);
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

  const openAdjust = (b: Bill) => {
    setAdjustTarget(b);
    setAdjustAmt(String(b.adjustAmount ?? ''));
    setAdjustMemoVal(b.adjustMemo ?? '');
    setAdjustOpen(true);
  };

  const handleAdjust = () => {
    if (!adjustTarget) return;
    const amt = Number(adjustAmt || 0);
    if (amt < 0) { toast('차감 금액은 0 이상이어야 합니다.', 'error'); return; }
    if (amt >= adjustTarget.amount) { toast('차감 금액이 청구액 이상일 수 없습니다.', 'error'); return; }
    adjustBill(adjustTarget.id, amt, adjustMemoVal);
    toast(`조정 저장 완료 (차감 ${amt.toLocaleString()}원)`);
    setAdjustOpen(false);
  };

  const fieldClass = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="수강료 청구 및 수납"
        actions={
          <>
            <Button variant="default" size="sm" onClick={() => toast('청구서가 발송되었습니다.', 'info')}><Send size={13} /> 청구서 발송</Button>
            <Button variant="dark" size="sm" onClick={() => toast('청구 등록은 추후 지원 예정입니다.', 'info')}><Plus size={13} /> 청구 등록</Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* KPI 카드 */}
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

        {/* 필터 + 테이블 */}
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="학생 이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-1.5 w-40 focus:outline-none focus:border-[#4fc3a1]"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as BillStatus | 'all')}
              className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">전체 상태</option>
              <option value={BillStatus.PAID}>완납</option>
              <option value={BillStatus.UNPAID}>미납</option>
              <option value={BillStatus.PARTIAL}>부분납</option>
            </select>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">전체 반</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">학생</th>
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">반</th>
                <th className="text-right px-4 py-2.5 text-[#6b7280] font-medium">청구액</th>
                <th className="text-right px-4 py-2.5 text-[#6b7280] font-medium">납부액</th>
                <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">납부기한</th>
                <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">상태</th>
                <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">납부방법</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((b) => {
                const st = STATUS_STYLE[b.status];
                const adj = b.adjustAmount ?? 0;
                return (
                  <tr key={b.id} className="hover:bg-[#f9fafb]">
                    <td className="px-4 py-3 font-medium text-[#111827]">{b.studentName}</td>
                    <td className="px-4 py-3 text-[#374151]">{b.className}</td>
                    <td className="px-4 py-3 text-right text-[#111827]">
                      <div className="flex items-center justify-end gap-1">
                        <span>{b.amount.toLocaleString()}원</span>
                        <button
                          onClick={() => openAdjust(b)}
                          className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors cursor-pointer"
                          title="조정금액 설정"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                      {adj > 0 && (
                        <div className="text-[11px] text-[#991B1B] mt-0.5" title={b.adjustMemo}>
                          차감 -{adj.toLocaleString()}원
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#111827]">{b.paidAmount.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center text-[#374151]">{formatKoreanDate(b.dueDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-1 rounded-[20px] text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-[#6b7280]">{b.method ?? '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {b.status !== BillStatus.PAID && (
                        <Button variant="primary" size="sm" onClick={() => openPay(b)}>수납</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {unpaidBills.length > 0 && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] p-4">
            <div className="text-[12.5px] font-semibold text-[#991B1B] mb-2">미납 학생 {unpaidBills.length}명</div>
            <div className="flex flex-wrap gap-2">
              {unpaidBills.map((b) => (
                <span key={b.id} className="px-2.5 py-1 bg-white border border-[#FECACA] rounded-[8px] text-[12px] text-[#991B1B]">
                  {b.studentName} ({b.className}) {b.amount.toLocaleString()}원
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 수납 처리 모달 */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="수납 처리"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setPayOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handlePay}>수납 완료</Button>
          </>
        }
      >
        {payTarget && (
          <div className="space-y-3">
            <div className="p-3 bg-[#f4f6f8] rounded-[8px] text-[12.5px]">
              <div className="font-semibold text-[#111827]">{payTarget.studentName}</div>
              <div className="text-[#6b7280]">{payTarget.className} · 청구 {payTarget.amount.toLocaleString()}원</div>
              {(payTarget.adjustAmount ?? 0) > 0 && (
                <div className="text-[#991B1B] text-[11.5px]">
                  차감 -{(payTarget.adjustAmount ?? 0).toLocaleString()}원
                  {payTarget.adjustMemo && <span className="ml-1 text-[#6b7280]">({payTarget.adjustMemo})</span>}
                </div>
              )}
              <div className="text-[#991B1B] font-medium">
                잔여 {(payTarget.amount - (payTarget.adjustAmount ?? 0) - payTarget.paidAmount).toLocaleString()}원
              </div>
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">수납 금액 *</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">납부 방법</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className={fieldClass}>
                <option value="카드">카드</option>
                <option value="계좌이체">계좌이체</option>
                <option value="현금">현금</option>
              </select>
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">납부일</label>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={fieldClass} />
            </div>
          </div>
        )}
      </Modal>

      {/* 청구액 조정 모달 */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="청구액 조정"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setAdjustOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAdjust}>저장</Button>
          </>
        }
      >
        {adjustTarget && (
          <div className="space-y-3">
            <div className="p-3 bg-[#f4f6f8] rounded-[8px] text-[12.5px]">
              <div className="font-semibold text-[#111827]">{adjustTarget.studentName}</div>
              <div className="text-[#6b7280]">{adjustTarget.className} · 청구액 {adjustTarget.amount.toLocaleString()}원</div>
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">차감 금액</label>
              <input
                type="number"
                placeholder="0"
                value={adjustAmt}
                onChange={(e) => setAdjustAmt(e.target.value)}
                className={fieldClass}
              />
              <div className="text-[11px] text-[#9ca3af] mt-1">
                실납부액: {(adjustTarget.amount - Number(adjustAmt || 0)).toLocaleString()}원
              </div>
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">조정 사유</label>
              <input
                type="text"
                placeholder="예) 3/15 수업 결석으로 인한 차감"
                value={adjustMemoVal}
                onChange={(e) => setAdjustMemoVal(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
