'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, Calendar, Clock, Users, AlertCircle, Check } from 'lucide-react';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { useMobileChild } from '@/contexts/MobileChildContext';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

interface Slot {
  id: string;
  classId: string;
  className: string;
  classColor: string;
  teacherName: string;
  makeupDate: string;       // YYYY-MM-DD
  makeupTime: string;
  reason: string;
  capacity: number | null;
  filledCount: number;
  remaining: number | null;
  applicationDeadline: string | null;
  deadlinePassed: boolean;
  eligibleStudentIds: string[];
  appliedStudentIds: string[];
}

interface SlotsResponse {
  children: { id: string; name: string }[];
  slots: Slot[];
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${dow})`;
}

function formatDeadline(iso: string | null): string {
  if (!iso) return '미설정';
  const d = new Date(iso);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${dow}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function deadlineRemaining(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '마감됨';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return `${hours}시간 남음`;
  const days = Math.floor(hours / 24);
  return `${days}일 ${hours % 24}시간 남음`;
}

export default function MobileMakeupPage() {
  const { selectedChildId, selectedChild } = useMobileChild();
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'available' | 'mine'>('available');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mobile/makeup/slots');
      if (!res.ok) throw new Error('조회 실패');
      const json: SlotsResponse = await res.json();
      setData(json);
    } catch {
      toast('보강 슬롯을 불러오는 데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const slots = data?.slots ?? [];
  const childId = selectedChildId;

  // 선택 자녀 기준 분류
  const availableForMe = useMemo(
    () =>
      slots.filter((s) => childId && s.eligibleStudentIds.includes(childId) && !s.appliedStudentIds.includes(childId)),
    [slots, childId],
  );
  const myApplications = useMemo(
    () => slots.filter((s) => childId && s.appliedStudentIds.includes(childId)),
    [slots, childId],
  );

  async function handleApply(slotId: string) {
    if (!childId) return;
    setBusy((b) => ({ ...b, [slotId]: true }));
    try {
      const res = await fetch(`/api/mobile/makeup/slots/${slotId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: childId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '신청 실패');
      toast('보강 신청 완료', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '신청 실패', 'error');
    } finally {
      setBusy((b) => ({ ...b, [slotId]: false }));
    }
  }

  async function handleCancel(slotId: string) {
    if (!childId) return;
    if (!confirm('보강 신청을 취소하시겠습니까?')) return;
    setBusy((b) => ({ ...b, [slotId]: true }));
    try {
      const res = await fetch(`/api/mobile/makeup/slots/${slotId}/apply`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: childId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '취소 실패');
      toast('신청이 취소되었습니다.', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '취소 실패', 'error');
    } finally {
      setBusy((b) => ({ ...b, [slotId]: false }));
    }
  }

  const renderCard = (slot: Slot, applied: boolean) => {
    const full = slot.capacity != null && slot.remaining === 0;
    const disabled = slot.deadlinePassed || full || busy[slot.id];
    return (
      <div key={slot.id} className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
        <div className="h-1" style={{ backgroundColor: slot.classColor }} />
        <div className="p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#111827]">{slot.className}</span>
            {applied && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#D1FAE5] text-[#065f46]">
                <Check size={11} /> 신청 완료
              </span>
            )}
            {!applied && full && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#f1f5f9] text-[#475569]">정원 마감</span>
            )}
          </div>
          <div className="space-y-1 text-[12px] text-[#374151]">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-[#9ca3af]" />
              <span>{formatDate(slot.makeupDate)}</span>
              <Clock size={13} className="text-[#9ca3af] ml-1" />
              <span>{slot.makeupTime}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-[#6b7280]">
              <Users size={13} className="text-[#9ca3af]" />
              <span>{slot.teacherName} 강사</span>
              <span className="ml-2">
                신청 {slot.filledCount}{slot.capacity ? `/${slot.capacity}` : ''}명
              </span>
            </div>
            {!applied && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#92400E]">
                <AlertCircle size={12} />
                <span>{slot.deadlinePassed ? '신청 마감됨' : deadlineRemaining(slot.applicationDeadline)}</span>
                <span className="text-[#9ca3af] ml-1">· 마감 {formatDeadline(slot.applicationDeadline)}</span>
              </div>
            )}
            {applied && (
              <div className="text-[11px] text-[#6b7280]">
                마감 전까지 취소 가능 · 마감 {formatDeadline(slot.applicationDeadline)}
              </div>
            )}
          </div>
          {!applied ? (
            <button
              disabled={disabled}
              onClick={() => handleApply(slot.id)}
              className={clsx(
                'w-full mt-2 py-2 rounded-[8px] text-[12.5px] font-semibold transition-colors',
                disabled
                  ? 'bg-[#e2e8f0] text-[#9ca3af] cursor-not-allowed'
                  : 'bg-[#1a2535] text-white hover:bg-[#0f1722] cursor-pointer',
              )}
            >
              {busy[slot.id] ? '처리 중...' : full ? '정원 마감' : slot.deadlinePassed ? '신청 마감' : '신청하기'}
            </button>
          ) : (
            <button
              disabled={slot.deadlinePassed || busy[slot.id]}
              onClick={() => handleCancel(slot.id)}
              className={clsx(
                'w-full mt-2 py-2 rounded-[8px] text-[12.5px] font-semibold transition-colors border',
                slot.deadlinePassed || busy[slot.id]
                  ? 'border-[#e2e8f0] text-[#9ca3af] cursor-not-allowed'
                  : 'border-[#ef4444] text-[#ef4444] hover:bg-[#fef2f2] cursor-pointer',
              )}
            >
              {busy[slot.id] ? '처리 중...' : slot.deadlinePassed ? '마감 후 학원 문의' : '신청 취소'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">보강 신청</span>
        </div>
        {selectedChild && (
          <div className="mt-3 text-[12px] text-white/70">
            {selectedChild.name} 학생
          </div>
        )}
      </div>

      <MobileContentLoader loading={loading}>
        <div className="px-4 py-4 space-y-3">
          {/* 탭 */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('available')}
              className={clsx(
                'flex-1 py-2 rounded-[8px] text-[12.5px] font-medium cursor-pointer transition-colors',
                tab === 'available' ? 'bg-[#1a2535] text-white' : 'bg-white text-[#6b7280] border border-[#e2e8f0]',
              )}
            >
              신청 가능 ({availableForMe.length})
            </button>
            <button
              onClick={() => setTab('mine')}
              className={clsx(
                'flex-1 py-2 rounded-[8px] text-[12.5px] font-medium cursor-pointer transition-colors',
                tab === 'mine' ? 'bg-[#1a2535] text-white' : 'bg-white text-[#6b7280] border border-[#e2e8f0]',
              )}
            >
              내 신청 ({myApplications.length})
            </button>
          </div>

          {tab === 'available' ? (
            availableForMe.length === 0 ? (
              <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-8 text-center">
                <Calendar size={28} className="text-[#d1d5db] mx-auto mb-2" />
                <div className="text-[13px] text-[#6b7280]">신청 가능한 보강 슬롯이 없습니다</div>
                <div className="text-[11.5px] text-[#9ca3af] mt-1">
                  자녀가 등록된 반의 오픈 보강 슬롯만 표시됩니다
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {availableForMe.map((s) => renderCard(s, false))}
              </div>
            )
          ) : myApplications.length === 0 ? (
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-8 text-center">
              <Calendar size={28} className="text-[#d1d5db] mx-auto mb-2" />
              <div className="text-[13px] text-[#6b7280]">신청한 보강이 없습니다</div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {myApplications.map((s) => renderCard(s, true))}
            </div>
          )}
        </div>
      </MobileContentLoader>
    </div>
  );
}
