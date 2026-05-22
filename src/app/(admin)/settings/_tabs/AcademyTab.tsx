'use client';
import { useState, useEffect } from 'react';
import { QrCode, Copy, ExternalLink, Receipt } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import Button from '@/components/shared/Button';

export default function AcademyTab() {
  const [kioskSlug, setKioskSlug] = useState('');

  // 청구 설정
  const [siblingDiscount, setSiblingDiscount] = useState(0);
  const [siblingDiscountInput, setSiblingDiscountInput] = useState('0');
  const [savingBilling, setSavingBilling] = useState(false);

  useEffect(() => {
    fetch('/api/settings/academy')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.slug) setKioskSlug(data.slug);
        const v = data?.siblingDiscountDefault ?? 0;
        setSiblingDiscount(v);
        setSiblingDiscountInput(String(v));
      });
  }, []);

  async function saveBillingSettings() {
    const amount = parseInt(siblingDiscountInput, 10);
    if (isNaN(amount) || amount < 0) {
      toast('할인 금액은 0 이상의 숫자여야 합니다.', 'error');
      return;
    }
    setSavingBilling(true);
    try {
      const res = await fetch('/api/settings/academy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siblingDiscountDefault: amount }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSiblingDiscount(amount);
      toast('청구 설정이 저장되었습니다.', 'success');
    } catch (e) {
      toast((e as Error).message || '저장 실패', 'error');
    } finally {
      setSavingBilling(false);
    }
  }

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

      {/* 청구 설정 */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={14} className="text-[#4fc3a1]" />
          <span className="text-[13px] font-semibold text-[#111827]">청구 기본 설정</span>
        </div>
        <p className="text-[11.5px] text-[#6b7280] mb-4">
          수강 등록 규칙(Layer 2) 생성 시 기본으로 채워질 형제 할인 금액입니다.
          개별 수강 등록에서 직접 수정할 수 있습니다.
        </p>

        <div className="space-y-1 mb-4">
          <label className="text-[12px] font-medium text-[#374151]">형제 할인 기본값 (원)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1000}
              value={siblingDiscountInput}
              onChange={(e) => setSiblingDiscountInput(e.target.value)}
              className="w-40 border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
              placeholder="0"
            />
            <span className="text-[12px] text-[#6b7280]">원</span>
          </div>
          {siblingDiscount !== parseInt(siblingDiscountInput, 10) && !isNaN(parseInt(siblingDiscountInput, 10)) && (
            <p className="text-[11px] text-[#f59e0b]">저장하지 않은 변경사항이 있습니다.</p>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={saveBillingSettings}
          disabled={savingBilling}
        >
          {savingBilling ? '저장 중…' : '저장'}
        </Button>
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
