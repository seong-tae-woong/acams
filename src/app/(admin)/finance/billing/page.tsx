'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import { useFinanceStore } from '@/lib/stores/financeStore';
import { useClassStore } from '@/lib/stores/classStore';
import { BillStatus } from '@/lib/types/finance';
import type { Bill } from '@/lib/types/finance';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { FINANCE_TABS, currentMonth, type BillingNotifTarget } from './_shared';
import BillingTab from './_tabs/BillingTab';
import PaymentsTab from './_tabs/PaymentsTab';
import OverdueTab from './_tabs/OverdueTab';
import PayModal from './_components/PayModal';
import AdjustModal from './_components/AdjustModal';
import AdjustHistoryModal from './_components/AdjustHistoryModal';
import PaymentHistoryModal from './_components/PaymentHistoryModal';
import BillingNotifModal from './_components/BillingNotifModal';
import GenerateModal from './_components/GenerateModal';
import CancelModal from './_components/CancelModal';
import RebillModal from './_components/RebillModal';
import BillingSettingsModal from './_components/BillingSettingsModal';
import { Settings } from 'lucide-react';

export default function BillingPage() {
  const {
    loading,
    fetchBills,
    fetchAvailableMonths, fetchAvailablePaidMonths,
  } = useFinanceStore();
  const { fetchClasses } = useClassStore();

  useEffect(() => {
    fetchAvailableMonths();
    fetchAvailablePaidMonths();
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 탭 ──────────────────────────────────────────────
  const [financeTab, setFinanceTab] = useState('billing');

  // ── 청구 탭 필터 상태 (청구 생성/취소/재청구 후 재조회에 필요) ──
  const [search, setSearch] = useState('');
  const [filterMonths, setFilterMonths] = useState<string[]>([currentMonth]);
  const [filterStatus, setFilterStatus] = useState<BillStatus | 'all'>('all');
  const [filterClass, setFilterClass] = useState<string>('all');

  // ── 검색어 디바운스 (~300ms) ──────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // 청구 탭: 선택 월 / 검색어 변경 시 서버 재조회
  useEffect(() => {
    fetchBills(filterMonths, { q: debouncedSearch || undefined });
  }, [filterMonths, debouncedSearch, fetchBills]);

  const refetchBills = () => fetchBills(filterMonths, { q: debouncedSearch || undefined });

  // ── 다중 선택 상태 ────────────────────────────────────
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
  const clearSelection = () => setSelectedBillIds(new Set());

  // ── 모달 상태 ─────────────────────────────────────────
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Bill | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Bill | null>(null);

  const [adjustHistOpen, setAdjustHistOpen] = useState(false);
  const [adjustHistStudent, setAdjustHistStudent] = useState<{ id: string; name: string } | null>(null);

  const [billingNotifOpen, setBillingNotifOpen] = useState(false);
  const [billingNotifTargets, setBillingNotifTargets] = useState<BillingNotifTarget[]>([]);
  const [billingNotifMonthLabel, setBillingNotifMonthLabel] = useState('');

  const [generateOpen, setGenerateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Bill | null>(null);

  const [rebillOpen, setRebillOpen] = useState(false);
  const [rebillCancelledIds, setRebillCancelledIds] = useState<string[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

  // ── 모달 오픈 핸들러 ──────────────────────────────────
  const openPay = (b: Bill) => { setPayTarget(b); setPayOpen(true); };
  const openAdjust = (b: Bill) => { setAdjustTarget(b); setAdjustOpen(true); };
  const openAdjustHistory = (b: Bill) => {
    setAdjustHistStudent({ id: b.studentId, name: b.studentName });
    setAdjustHistOpen(true);
  };
  const openCancel = (b: Bill) => { setCancelTarget(b); setCancelOpen(true); };
  const openRebill = (cancelledIds: string[]) => {
    if (cancelledIds.length === 0) { return; }
    setRebillCancelledIds(cancelledIds);
    setRebillOpen(true);
  };
  const openBillingNotif = (targets: BillingNotifTarget[], monthLabel: string) => {
    setBillingNotifTargets(targets);
    setBillingNotifMonthLabel(monthLabel);
    setBillingNotifOpen(true);
  };
  const openDetail = (studentId: string) => {
    setDetailStudentId(studentId);
    setDetailOpen(true);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="청구/수납/미납"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings size={13} /> 청구 설정
            </Button>
            <Button variant="dark" size="sm" onClick={() => setGenerateOpen(true)}>
              청구 생성
            </Button>
          </div>
        }
      />

      {/* 탭 네비게이션 */}
      <Tabs tabs={FINANCE_TABS} value={financeTab} onChange={setFinanceTab} className="bg-white px-5 shrink-0" />

      {loading ? <LoadingSpinner /> : <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* ── 청구 및 수납 탭 ── */}
        {financeTab === 'billing' && (
          <BillingTab
            search={search}
            setSearch={setSearch}
            filterMonths={filterMonths}
            setFilterMonths={setFilterMonths}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterClass={filterClass}
            setFilterClass={setFilterClass}
            selectedBillIds={selectedBillIds}
            setSelectedBillIds={setSelectedBillIds}
            onOpenPay={openPay}
            onOpenAdjust={openAdjust}
            onOpenAdjustHistory={openAdjustHistory}
            onOpenCancel={openCancel}
            onOpenRebill={openRebill}
            onBillingNotif={openBillingNotif}
          />
        )}

        {/* ── 수납 내역 탭 ── */}
        {financeTab === 'payments' && <PaymentsTab />}

        {/* ── 미납 관리 탭 ── */}
        {financeTab === 'overdue' && <OverdueTab onOpenDetail={openDetail} />}

      </div>}

      {/* ── 수납 처리 모달 ── */}
      {payOpen && (
        <PayModal open={payOpen} onClose={() => setPayOpen(false)} target={payTarget} />
      )}

      {/* ── 청구액 조정 모달 ── */}
      {adjustOpen && (
        <AdjustModal open={adjustOpen} onClose={() => setAdjustOpen(false)} target={adjustTarget} />
      )}

      {/* ── 청구액 조정 이력 모달 ── */}
      {adjustHistOpen && (
        <AdjustHistoryModal open={adjustHistOpen} onClose={() => setAdjustHistOpen(false)} student={adjustHistStudent} />
      )}

      {/* ── 수강료 납부 이력 모달 (미납 탭) ── */}
      <PaymentHistoryModal open={detailOpen} onClose={() => setDetailOpen(false)} studentId={detailStudentId} />

      {/* ── 청구서 발송 확인 모달 ── */}
      <BillingNotifModal
        open={billingNotifOpen}
        onClose={() => setBillingNotifOpen(false)}
        targets={billingNotifTargets}
        monthLabel={billingNotifMonthLabel}
        onSent={clearSelection}
      />

      {/* ── 청구 생성 모달 ── */}
      <GenerateModal open={generateOpen} onClose={() => setGenerateOpen(false)} refetchBills={refetchBills} />

      {/* ── 청구 설정 모달 (형제 할인 + 명칭 사전) ── */}
      <BillingSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ── 청구서 취소 확인 모달 ── */}
      {cancelOpen && (
        <CancelModal
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          target={cancelTarget}
          refetchBills={refetchBills}
          clearSelection={clearSelection}
        />
      )}

      {/* ── 재청구 모달 ── */}
      {rebillOpen && (
        <RebillModal
          open={rebillOpen}
          onClose={() => setRebillOpen(false)}
          cancelledIds={rebillCancelledIds}
          refetchBills={refetchBills}
          clearSelection={clearSelection}
        />
      )}
    </div>
  );
}
