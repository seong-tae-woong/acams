'use client';
import { useState, useEffect } from 'react';
import { QrCode, Copy, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

export default function AcademyTab() {
  const [kioskSlug, setKioskSlug] = useState('');

  useEffect(() => {
    fetch('/api/settings/academy')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.slug) setKioskSlug(data.slug);
      });
  }, []);

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

      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-semibold text-[#111827]">알림 설정</span>
          <span className="text-[10.5px] font-medium text-[#92400E] bg-[#FEF3C7] rounded-[20px] px-2 py-0.5">준비중</span>
        </div>
        <p className="text-[11.5px] text-[#9ca3af] mb-3">
          자동 알림 기능은 아직 준비 중입니다. 현재는 어떤 알림도 자동으로 발송되지 않습니다.
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
