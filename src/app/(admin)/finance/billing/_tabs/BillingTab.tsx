'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Button from '@/components/shared/Button';
import SearchInput from '@/components/shared/SearchInput';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { BillStatus } from '@/lib/types/finance';
import type { Bill } from '@/lib/types/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { toast } from '@/lib/stores/toastStore';
import { Send, ChevronDown, Check, Pencil, RotateCcw, Ban, CheckCheck, Tag, FileText, X } from 'lucide-react';
import clsx from 'clsx';
import { STATUS_STYLE, formatMonth, type BillingNotifTarget } from '../_shared';
import MonthlyAdjustModal from '../_components/MonthlyAdjustModal';
import BillDetailModal from '../_components/BillDetailModal';

interface BillingTabProps {
  search: string;
  setSearch: (v: string) => void;
  filterMonths: string[];
  setFilterMonths: React.Dispatch<React.SetStateAction<string[]>>;
  filterStatus: BillStatus | 'all';
  setFilterStatus: React.Dispatch<React.SetStateAction<BillStatus | 'all'>>;
  filterClass: string;
  setFilterClass: React.Dispatch<React.SetStateAction<string>>;
  selectedBillIds: Set<string>;
  setSelectedBillIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onOpenPay: (b: Bill) => void;
  onOpenAdjust: (b: Bill) => void;
  onOpenAdjustHistory: (b: Bill) => void;
  onOpenCancel: (b: Bill) => void;
  onOpenRebill: (cancelledIds: string[]) => void;
  onBillingNotif: (targets: BillingNotifTarget[], monthLabel: string) => void;
}

export default function BillingTab({
  search, setSearch,
  filterMonths, setFilterMonths,
  filterStatus, setFilterStatus,
  filterClass, setFilterClass,
  selectedBillIds, setSelectedBillIds,
  onOpenPay, onOpenAdjust, onOpenAdjustHistory, onOpenCancel, onOpenRebill,
  onBillingNotif,
}: BillingTabProps) {
  const { bills, availableMonths, fetchBills } = useFinanceStore();
  const { classes } = useClassStore();
  const { students, fetchStudents } = useStudentStore();
  const { currentUser } = useAuthStore();

  // 학생 store hydrate — 월별 조정 모달의 학생 목록 표시에 필요
  useEffect(() => {
    if (students.length === 0) {
      fetchStudents();
    }
  }, [students.length, fetchStudents]);
  const isDirector = currentUser?.role === 'director' || currentUser?.role === 'super_admin';
  const [confirmingDraft, setConfirmingDraft] = useState(false);

  // 월별 조정 모달
  const [monthlyAdjustOpen, setMonthlyAdjustOpen] = useState(false);

  // 세부 내역 모달
  const [detailBill, setDetailBill] = useState<Bill | null>(null);

  // 반별 활성 학생 맵 (모달 prop으로 전달)
  const studentsByClass = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    for (const c of classes) {
      const sids = c.students ?? [];
      map[c.id] = sids
        .map((sid) => students.find((s) => s.id === sid))
        .filter((s): s is NonNullable<typeof s> => !!s && s.status === '재원')
        .map((s) => ({ id: s.id, name: s.name }));
    }
    return map;
  }, [classes, students]);

  // ── 청구 탭 상태 ──────────────────────────────────────
  const [monthDropOpen, setMonthDropOpen] = useState(false);
  const monthDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (monthDropRef.current && !monthDropRef.current.contains(e.target as Node)) setMonthDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── 청구 탭 계산 ──────────────────────────────────────
  const toggleMonth = (m: string) => {
    setFilterMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const monthLabel = filterMonths.length === 0 ? '전체 월'
    : filterMonths.length === 1 ? formatMonth(filterMonths[0])
    : `${filterMonths.length}개월`;

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

  // 선택된 취소됨 / 초안 청구서 목록
  const selectedCancelledBills = filtered.filter((b) => selectedBillIds.has(b.id) && b.status === BillStatus.CANCELLED);
  const selectedDraftBills = filtered.filter((b) => selectedBillIds.has(b.id) && b.status === BillStatus.DRAFT);

  // DRAFT → UNPAID 일괄 확정
  async function confirmDraftBills() {
    if (selectedDraftBills.length === 0) return;
    setConfirmingDraft(true);
    try {
      const res = await fetch('/api/finance/bills/draft-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billIds: selectedDraftBills.map((b) => b.id) }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || '확정 실패', 'error');
        return;
      }
      const data = await res.json() as { confirmed: number };
      toast(`${data.confirmed}건 확정 완료 → 미납 상태로 전환되었습니다.`, 'success');
      setSelectedBillIds(new Set());
      await fetchBills();
    } catch {
      toast('확정 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setConfirmingDraft(false);
    }
  }

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
          <SearchInput value={search} onChange={setSearch} placeholder="학생 이름 검색" className="w-40" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as BillStatus | 'all')} className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none cursor-pointer">
            <option value="all">전체 상태</option>
            <option value={BillStatus.DRAFT}>초안</option>
            <option value={BillStatus.PAID}>완납</option>
            <option value={BillStatus.UNPAID}>미납</option>
            <option value={BillStatus.PARTIAL}>부분납</option>
            <option value={BillStatus.CANCELLED}>취소됨</option>
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
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-10 min-w-[180px] py-1">
                <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#6b7280]" onClick={() => { setFilterMonths([]); setMonthDropOpen(false); }}>
                  <Check size={12} className={clsx(filterMonths.length === 0 ? 'text-[#4fc3a1]' : 'invisible')} />전체 월
                </div>
                <div className="border-t border-[#f1f5f9] my-1" />
                {availableMonths.map((m) => (
                  <div key={m} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#374151]" onClick={() => { setFilterMonths([m]); setMonthDropOpen(false); }}>
                    <input
                      type="checkbox"
                      checked={filterMonths.includes(m)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleMonth(m)}
                      className="w-3.5 h-3.5 cursor-pointer accent-[#4fc3a1]"
                      title="여러 달 선택"
                    />
                    {formatMonth(m)}
                  </div>
                ))}
              </div>
            )}
          </div>
          {filterMonths.length >= 2 && (
            <div className="flex items-center gap-1 flex-wrap">
              {[...filterMonths].sort().reverse().map((m) => (
                <span key={m} className="inline-flex items-center gap-1 text-[11.5px] bg-[#eef7f3] text-[#0D9E7A] border border-[#cdeee2] rounded-[20px] pl-2 pr-1 py-0.5">
                  {formatMonth(m)}
                  <button type="button" onClick={() => toggleMonth(m)} className="hover:bg-[#cdeee2] rounded-full p-0.5 cursor-pointer" title="제거">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <span className="text-[12px] text-[#6b7280] ml-auto">{filtered.length}건</span>
          {selectedBillIds.size > 0 && (
            <span className="text-[12px] text-[#4fc3a1] font-medium">{selectedBillIds.size}개 선택됨</span>
          )}
          {isDirector && (
            <span
              className="inline-flex"
              title={filterMonths.length === 1 ? '이번 달 교재비·활동비 등 일회성 조정 추가' : '단일 월을 선택하면 추가할 수 있어요'}
            >
              <Button
                variant="default"
                size="sm"
                disabled={filterMonths.length !== 1}
                onClick={() => setMonthlyAdjustOpen(true)}
              >
                <Tag size={13} /> 월별 조정
              </Button>
            </span>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              if (selectedBillIds.size === 0) { toast('학생을 선택하세요.', 'error'); return; }
              onBillingNotif(billingNotifTargets, monthLabel);
            }}
          >
            <Send size={13} /> 청구서 발송
          </Button>
          {selectedDraftBills.length > 0 && isDirector && (
            <Button
              variant="primary"
              size="sm"
              onClick={confirmDraftBills}
              disabled={confirmingDraft}
            >
              <CheckCheck size={13} /> 확정 {selectedDraftBills.length}건
            </Button>
          )}
          {selectedCancelledBills.length > 0 && (
            <Button
              variant="dark"
              size="sm"
              onClick={() => onOpenRebill(selectedCancelledBills.map((b) => b.id))}
            >
              <RotateCcw size={13} /> 재청구 ({selectedCancelledBills.length}건)
            </Button>
          )}
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
              {[
                { label: '학생', cls: 'text-left w-20' },
                { label: '반', cls: 'text-left w-36' },
                { label: '결제 단위', cls: 'text-center w-20' },
                { label: '청구액', cls: 'text-right w-32' },
                { label: '메모', cls: 'text-left w-28' },
                { label: '납부액', cls: 'text-right w-24' },
                { label: '납부기한', cls: 'text-center w-24' },
                { label: '발송', cls: 'text-center w-16' },
                { label: '상태', cls: 'text-center w-16' },
                { label: '납부방법', cls: 'text-center w-20' },
                { label: '', cls: 'w-14' },
              ].map((h) => (
                <th key={h.label} className={clsx('px-2 py-2.5 text-[#6b7280] font-medium', h.cls)}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {filtered.map((b) => {
              const st = STATUS_STYLE[b.status];
              const adj = b.adjustAmount ?? 0;
              const isSelected = selectedBillIds.has(b.id);
              return (
                <tr key={b.id} className={clsx(
                  'hover:bg-[#f9fafb]',
                  isSelected && 'bg-[#f0fdf8]',
                  b.status === BillStatus.DRAFT && !isSelected && 'bg-[#FFFBEB]',
                  b.status === BillStatus.CANCELLED && 'opacity-60',
                )}>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleBill(b.id)}
                      className="w-3.5 h-3.5 cursor-pointer accent-[#4fc3a1]"
                    />
                  </td>
                  <td className="px-2 py-3 font-medium text-[#111827]">{b.studentName}</td>
                  <td className="px-2 py-3 text-[#374151] truncate max-w-[144px]">{b.className}</td>
                  <td className="px-2 py-3 text-center">
                    {b.feeType === 'per-lesson'
                      ? <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-[#EDE9FE] text-[#5B21B6]">수업단위별</span>
                      : b.feeType === 'weekly'
                      ? <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-[#DBEAFE] text-[#1d4ed8]">주별</span>
                      : <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-[#F1F5F9] text-[#475569]">월별</span>
                    }
                  </td>
                  <td className="px-2 py-3 text-right text-[#111827]">
                    <div className="flex items-center justify-end gap-1">
                      <span>{b.amount.toLocaleString()}원</span>
                      <button
                        onClick={() => b.hasAdjustments && setDetailBill(b)}
                        disabled={!b.hasAdjustments}
                        className={clsx(
                          'transition-colors',
                          b.hasAdjustments
                            ? 'text-[#5B4FBE] hover:text-[#4338CA] cursor-pointer'
                            : 'text-[#d1d5db] cursor-not-allowed',
                        )}
                        title={b.hasAdjustments ? '세부 내역 보기' : '조정 내역 없음 (기본 수강료만 청구)'}
                      >
                        <FileText size={11} />
                      </button>
                      <button onClick={() => onOpenAdjust(b)} className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors cursor-pointer" title="조정금액 설정"><Pencil size={11} /></button>
                    </div>
                    {adj > 0 && <div className="text-[11px] text-[#991B1B] mt-0.5">차감 -{adj.toLocaleString()}원</div>}
                    {(b.adjustCount ?? 0) > 0 && (
                      <button
                        onClick={() => onOpenAdjustHistory(b)}
                        className="block ml-auto text-[10.5px] text-[#5B4FBE] hover:underline mt-0.5 cursor-pointer"
                        title="조정 이력 보기"
                      >
                        변경 {b.adjustCount}건
                      </button>
                    )}
                    {b.feeType === 'per-lesson' && b.scheduledCount != null && (
                      <div className="text-[10.5px] text-[#6b7280] mt-0.5">
                        배정 {b.scheduledCount}회
                        {(b.absentCount ?? 0) > 0 && <span className="text-[#991B1B]"> · 결석 -{b.absentCount}회</span>}
                        {(b.makeupCount ?? 0) > 0 && <span className="text-[#065f46]"> · 보강 +{b.makeupCount}회</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 max-w-[112px]">
                    <button onClick={() => onOpenAdjust(b)} className="text-left w-full hover:text-[#4fc3a1] transition-colors cursor-pointer" title="메모 수정">
                      {b.adjustMemo ? (
                        <span className="text-[12px] text-[#374151]">{b.adjustMemo}</span>
                      ) : (
                        <span className="text-[11.5px] text-[#d1d5db] italic">메모 추가...</span>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-3 text-right text-[#111827]">{b.paidAmount.toLocaleString()}원</td>
                  <td className="px-2 py-3 text-center text-[#374151]">{formatKoreanDate(b.dueDate)}</td>
                  <td className="px-2 py-3 text-center">
                    {b.notifiedAt
                      ? <span className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium bg-[#D1FAE5] text-[#065f46]" title={`발송: ${formatKoreanDate(b.notifiedAt.slice(0, 10))}`}>발송됨</span>
                      : <span className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium bg-[#F1F5F9] text-[#6b7280]">미발송</span>
                    }
                  </td>
                  <td className="px-2 py-3 text-center"><span className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                  <td className="px-2 py-3 text-center text-[#6b7280]">{b.method ?? '-'}</td>
                  <td className="px-2 py-3 text-center">
                    {b.status === BillStatus.DRAFT && isDirector && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedBillIds(new Set([b.id]));
                          confirmDraftBills();
                        }}
                        title="이 청구서를 미납 상태로 확정"
                      >
                        확정
                      </Button>
                    )}
                    {b.status !== BillStatus.PAID && b.status !== BillStatus.CANCELLED && b.status !== BillStatus.DRAFT && (
                      <Button variant="primary" size="sm" onClick={() => onOpenPay(b)}>수납</Button>
                    )}
                    {b.status === BillStatus.PAID && (
                      <Button variant="danger" size="sm" onClick={() => onOpenCancel(b)}>
                        <Ban size={11} /> 취소
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 월별 조정 모달 — filterMonths.length === 1일 때만 활성화됨 */}
      {monthlyAdjustOpen && filterMonths.length === 1 && (
        <MonthlyAdjustModal
          open={monthlyAdjustOpen}
          onClose={() => setMonthlyAdjustOpen(false)}
          billingMonth={filterMonths[0]}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          studentsByClass={studentsByClass}
          onSaved={() => fetchBills()}
        />
      )}

      {/* 청구서 세부 내역 모달 */}
      <BillDetailModal
        open={!!detailBill}
        onClose={() => setDetailBill(null)}
        bill={detailBill}
      />
    </>
  );
}
