'use client';
import { useState, useEffect } from 'react';
import { QrCode, Copy, ExternalLink, MessageSquare } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

export default function AcademyTab() {
  const [kioskSlug, setKioskSlug] = useState('');
  const [smsEnabled, setSmsEnabled] = useState<boolean | null>(null); // null=로딩중
  const [smsSaving, setSmsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/academy')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.slug) setKioskSlug(data.slug);
        if (typeof data?.smsEnabled === 'boolean') setSmsEnabled(data.smsEnabled);
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
          <span className="text-[13px] font-semibold text-[#111827]">자동 알림</span>
          <span className="text-[10.5px] font-medium text-[#92400E] bg-[#FEF3C7] rounded-[20px] px-2 py-0.5">준비중</span>
        </div>
        <p className="text-[11.5px] text-[#9ca3af] mb-3">
          아래 트리거 기반 자동 알림은 아직 준비 중입니다. (비밀번호 SMS는 위 설정과 무관하게 동작합니다.)
        </p>
        {[
          { label: '결석 시 학부모 자동 알림', desc: '출결 저장 20분 후 발송' },
          { label: '수강료 미납 자동 알림', desc: '납부기한 다음날 발송' },
          { label: '성적 등록 알림', desc: '시험 성적 등록 시 발송' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9] last:border-0">
            <div>
              <div className="text-[12.5px] font-medium text-[#9ca3af]">{item.label}</div>
              <div className="text-[11px] text-[#9ca3af]">{item.desc}</div>
            </div>
            <div className="w-9 h-5 rounded-full bg-[#e2e8f0] relative cursor-not-allowed" title="준비중">
              <div className="absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] left-[3px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
