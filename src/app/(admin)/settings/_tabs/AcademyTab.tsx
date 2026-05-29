'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { QrCode, Copy, ExternalLink, MessageSquare, Bell } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

export default function AcademyTab() {
  const [kioskSlug, setKioskSlug] = useState('');
  const [smsEnabled, setSmsEnabled] = useState<boolean | null>(null); // null=로딩중
  const [smsSaving, setSmsSaving] = useState(false);

  // 자동 알림 (결석/지각)
  const [attendNotifyEnabled, setAttendNotifyEnabled] = useState<boolean | null>(null);
  const [attendNotifySaving, setAttendNotifySaving] = useState(false);
  const [lateMin, setLateMin] = useState<number>(10);
  const [absentMin, setAbsentMin] = useState<number>(20);
  const [lateInput, setLateInput] = useState<string>('10');
  const [absentInput, setAbsentInput] = useState<string>('20');

  useEffect(() => {
    fetch('/api/settings/academy')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.slug) setKioskSlug(data.slug);
        if (typeof data?.smsEnabled === 'boolean') setSmsEnabled(data.smsEnabled);
        if (typeof data?.attendanceNotifyEnabled === 'boolean') setAttendNotifyEnabled(data.attendanceNotifyEnabled);
        if (typeof data?.attendanceLateMinutes === 'number') {
          setLateMin(data.attendanceLateMinutes);
          setLateInput(String(data.attendanceLateMinutes));
        }
        if (typeof data?.attendanceAbsentMinutes === 'number') {
          setAbsentMin(data.attendanceAbsentMinutes);
          setAbsentInput(String(data.attendanceAbsentMinutes));
        }
      });
  }, []);

  const handleSmsToggle = async () => {
    if (smsEnabled === null || smsSaving) return;
    const next = !smsEnabled;
    setSmsSaving(true);
    try {
      const res = await fetch('/api/settings/academy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsEnabled: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? 'SMS 설정 변경에 실패했습니다.', 'error');
        return;
      }
      setSmsEnabled(next);
      toast(next ? 'SMS 자동 발송이 켜졌습니다.' : 'SMS 자동 발송이 꺼졌습니다.', 'success');
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setSmsSaving(false);
    }
  };

  const handleAttendNotifyToggle = async () => {
    if (attendNotifyEnabled === null || attendNotifySaving) return;
    const next = !attendNotifyEnabled;
    setAttendNotifySaving(true);
    try {
      const res = await fetch('/api/settings/academy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceNotifyEnabled: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? '자동 알림 설정 변경에 실패했습니다.', 'error');
        return;
      }
      setAttendNotifyEnabled(next);
      toast(next ? '결석/지각 자동 알림이 켜졌습니다.' : '결석/지각 자동 알림이 꺼졌습니다.', 'success');
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setAttendNotifySaving(false);
    }
  };

  // 임계값 저장 (blur 시): 두 값을 묶어서 PATCH. 검증 실패 시 입력값을 저장값으로 되돌림.
  const handleThresholdSave = async () => {
    const nextLate = parseInt(lateInput, 10);
    const nextAbsent = parseInt(absentInput, 10);
    if (!Number.isFinite(nextLate) || !Number.isFinite(nextAbsent)) {
      setLateInput(String(lateMin));
      setAbsentInput(String(absentMin));
      toast('임계값은 숫자로 입력해주세요.', 'error');
      return;
    }
    if (nextLate === lateMin && nextAbsent === absentMin) return; // 변경 없음
    try {
      const res = await fetch('/api/settings/academy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceLateMinutes: nextLate,
          attendanceAbsentMinutes: nextAbsent,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? '임계값 저장에 실패했습니다.', 'error');
        setLateInput(String(lateMin));
        setAbsentInput(String(absentMin));
        return;
      }
      setLateMin(nextLate);
      setAbsentMin(nextAbsent);
      toast('임계값이 저장되었습니다.', 'success');
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
      setLateInput(String(lateMin));
      setAbsentInput(String(absentMin));
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      {/* 키오스크 URL */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
        <div className="flex items-center gap-2 mb-3">
          <QrCode size={14} className="text-[#4fc3a1]" />
          <span className="text-[13px] font-semibold text-[#111827]">QR 출석 키오스크 URL</span>
        </div>
        <p className="text-[11.5px] text-[#6b7280] mb-3">
          학원 입구 태블릿·폰 브라우저에서 아래 URL을 접속하면 QR 출석 키오스크가 시작됩니다.
        </p>
        {kioskSlug ? (
          <div className="flex items-center gap-2 bg-[#f4f6f8] rounded-[8px] px-3 py-2.5">
            <span className="text-[12px] text-[#374151] flex-1 font-mono truncate">
              {typeof window !== 'undefined' ? window.location.origin : ''}/kiosk?academy={kioskSlug}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/kiosk?academy=${kioskSlug}`);
                toast('키오스크 URL이 복사되었습니다.', 'success');
              }}
              className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors cursor-pointer shrink-0"
              title="URL 복사"
            >
              <Copy size={13} />
            </button>
            <a
              href={`/kiosk?academy=${kioskSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors shrink-0"
              title="키오스크 열기"
            >
              <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <p className="text-[12px] text-[#9ca3af]">
            공개 페이지 탭에서 학원 슬러그를 먼저 설정해주세요.
          </p>
        )}
      </div>

      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
        <p className="text-[11.5px] text-[#6b7280]">
          💡 형제 할인 자동 적용 · 월별 조정 명칭 사전 관리는 <strong>재무 &gt; 청구/수납/미납</strong> 화면 우측 상단의 <strong>[청구 설정]</strong> 버튼에서 가능합니다.
        </p>
      </div>

      {/* 임시 비밀번호 SMS 토글 */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={14} className="text-[#4fc3a1]" />
          <span className="text-[13px] font-semibold text-[#111827]">임시 비밀번호 SMS 자동 발송</span>
        </div>
        <p className="text-[11.5px] text-[#6b7280] mb-3">
          학생 등록 · 비밀번호 초기화 시 임시 비밀번호를 학생/학부모/강사에게 자동으로 SMS 발송합니다.
          <br />
          <span className="text-[#9ca3af]">끄면 등록 화면에서 비밀번호를 직접 지정합니다. 학생 첫 로그인 시 비밀번호 변경이 강제되지 않아 같은 비번을 재사용할 수 있습니다 (테스트 모드).</span>
        </p>
        <div className="flex items-center justify-between py-2.5 border-t border-[#f1f5f9]">
          <div>
            <div className="text-[12.5px] font-medium text-[#111827]">SMS 자동 발송</div>
            <div className="text-[11px] text-[#6b7280]">
              {smsEnabled === null ? '불러오는 중...'
                : smsEnabled ? '발송 켜짐 — 실 운영 모드'
                : '발송 꺼짐 — 테스트 모드'}
            </div>
          </div>
          <button
            onClick={handleSmsToggle}
            disabled={smsEnabled === null || smsSaving}
            className={
              'w-9 h-5 rounded-full relative transition-colors ' +
              (smsEnabled === null || smsSaving ? 'cursor-not-allowed opacity-60 ' : 'cursor-pointer ') +
              (smsEnabled ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')
            }
            title={smsEnabled ? '끄기' : '켜기'}
          >
            <div
              className={
                'absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all ' +
                (smsEnabled ? 'left-[19px]' : 'left-[3px]')
              }
            />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={14} className="text-[#4fc3a1]" />
          <span className="text-[13px] font-semibold text-[#111827]">자동 알림</span>
        </div>
        <p className="text-[11.5px] text-[#6b7280] mb-3">
          수업 시작 후 일정 시간이 지나도 출석 체크가 되지 않은 학생의 학부모에게 PWA 알림을 자동 발송합니다.
        </p>

        <div className="flex items-center justify-between py-2.5 border-t border-[#f1f5f9]">
          <div>
            <div className="text-[12.5px] font-medium text-[#111827]">결석 시 학부모 자동 알림</div>
            <div className="text-[11px] text-[#6b7280]">
              {attendNotifyEnabled === null ? '불러오는 중...'
                : attendNotifyEnabled ? '발송 켜짐 — 지각·결석 임계값 도달 시 PWA 알림'
                : '발송 꺼짐'}
            </div>
          </div>
          <button
            onClick={handleAttendNotifyToggle}
            disabled={attendNotifyEnabled === null || attendNotifySaving}
            className={
              'w-9 h-5 rounded-full relative transition-colors ' +
              (attendNotifyEnabled === null || attendNotifySaving ? 'cursor-not-allowed opacity-60 ' : 'cursor-pointer ') +
              (attendNotifyEnabled ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')
            }
            title={attendNotifyEnabled ? '끄기' : '켜기'}
          >
            <div
              className={
                'absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all ' +
                (attendNotifyEnabled ? 'left-[19px]' : 'left-[3px]')
              }
            />
          </button>
        </div>

        {attendNotifyEnabled && (
          <div className="pt-3 pl-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-[#6b7280] w-20">지각 임계값</span>
              <span className="text-[11.5px] text-[#6b7280]">수업 시작 후</span>
              <input
                type="number"
                min={1}
                max={59}
                value={lateInput}
                onChange={(e) => setLateInput(e.target.value)}
                onBlur={handleThresholdSave}
                className="w-14 text-[12px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 text-center focus:outline-none focus:border-[#4fc3a1]"
              />
              <span className="text-[11.5px] text-[#6b7280]">분 후 지각 알림</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-[#6b7280] w-20">결석 임계값</span>
              <span className="text-[11.5px] text-[#6b7280]">수업 시작 후</span>
              <input
                type="number"
                min={2}
                max={60}
                value={absentInput}
                onChange={(e) => setAbsentInput(e.target.value)}
                onBlur={handleThresholdSave}
                className="w-14 text-[12px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 text-center focus:outline-none focus:border-[#4fc3a1]"
              />
              <span className="text-[11.5px] text-[#6b7280]">분 후 결석 알림</span>
            </div>
            <p className="text-[10.5px] text-[#9ca3af] pt-1 leading-relaxed">
              예) 지각 {lateMin}분 / 결석 {absentMin}분 → 수업 시작 {lateMin}분 후 미체크 학생은 지각 알림,
              {' '}{absentMin}분 후에도 여전히 미체크면 결석 알림.
              <br />
              알림은 학부모 PWA에서 확인할 수 있어요. 학원 키오스크/강사 체크로 출석 처리된 학생은 발송 대상에서 자동 제외됩니다.
            </p>
            <Link
              href="/communication/notifications?tab=templates&category=출결알림"
              className="inline-block text-[11px] text-[#4fc3a1] hover:underline mt-1"
            >
              알림 문구 편집 →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
