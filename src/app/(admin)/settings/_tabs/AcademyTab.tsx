'use client';
import { useState, useEffect } from 'react';
import { QrCode, Copy, ExternalLink, Receipt, Tag, X, Plus } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import Button from '@/components/shared/Button';

export default function AcademyTab() {
  const [kioskSlug, setKioskSlug] = useState('');

  // 청구 설정
  const [siblingDiscount, setSiblingDiscount] = useState(0);
  const [siblingDiscountInput, setSiblingDiscountInput] = useState('0');
  const [siblingDiscountType, setSiblingDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [siblingDiscountTypeSaved, setSiblingDiscountTypeSaved] = useState<'fixed' | 'percent'>('fixed');
  const [savingBilling, setSavingBilling] = useState(false);

  // 조정 명칭 사전
  const [labels, setLabels] = useState<{ id: string; name: string }[]>([]);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    fetch('/api/settings/academy')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.slug) setKioskSlug(data.slug);
        const v = data?.siblingDiscountDefault ?? 0;
        const t = data?.siblingDiscountType ?? 'fixed';
        setSiblingDiscount(v);
        setSiblingDiscountInput(String(v));
        setSiblingDiscountType(t);
        setSiblingDiscountTypeSaved(t);
      });
    fetch('/api/finance/adjustments/labels')
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => setLabels(data));
  }, []);

  async function saveBillingSettings() {
    const amount = parseInt(siblingDiscountInput, 10);
    if (isNaN(amount) || amount < 0) {
      toast('할인 금액은 0 이상의 숫자여야 합니다.', 'error');
      return;
    }
    if (siblingDiscountType === 'percent' && amount > 100) {
      toast('퍼센트 할인은 100을 초과할 수 없습니다.', 'error');
      return;
    }
    setSavingBilling(true);
    try {
      const res = await fetch('/api/settings/academy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siblingDiscountDefault: amount,
          siblingDiscountType,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSiblingDiscount(amount);
      setSiblingDiscountTypeSaved(siblingDiscountType);
      toast('청구 설정이 저장되어 모든 형제 학생에 자동 반영되었습니다.', 'success');
    } catch (e) {
      toast((e as Error).message || '저장 실패', 'error');
    } finally {
      setSavingBilling(false);
    }
  }

  async function addLabel() {
    const name = newLabel.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/finance/adjustments/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || '추가 실패', 'error');
        return;
      }
      const created = await res.json() as { id: string; name: string };
      if (!labels.some((l) => l.id === created.id)) {
        setLabels((prev) => [...prev, { id: created.id, name: created.name }]);
      }
      setNewLabel('');
      toast('명칭이 추가되었습니다.', 'success');
    } catch {
      toast('추가 실패', 'error');
    }
  }

  async function deleteLabel(id: string) {
    try {
      const res = await fetch(`/api/finance/adjustments/labels/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast('삭제 실패', 'error');
        return;
      }
      setLabels((prev) => prev.filter((l) => l.id !== id));
      toast('명칭이 삭제되었습니다.', 'success');
    } catch {
      toast('삭제 실패', 'error');
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

      {/* 형제 할인 자동 적용 */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={14} className="text-[#4fc3a1]" />
          <span className="text-[13px] font-semibold text-[#111827]">형제 할인 자동 적용</span>
        </div>
        <p className="text-[11.5px] text-[#6b7280] mb-4">
          학원에 형제·자매가 함께 재원 중인 학생에게 자동으로 적용되는 할인입니다.
          저장 시 현재 재원생 전체에 즉시 반영되며, 새 학생 추가 또는 형제 관계 변경 시에도 자동으로 동기화됩니다.
        </p>

        <div className="space-y-2 mb-4">
          <label className="text-[12px] font-medium text-[#374151]">할인 방식</label>
          <div className="flex rounded-[8px] border border-[#e2e8f0] overflow-hidden text-[12.5px] font-medium w-fit">
            {(['fixed', 'percent'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSiblingDiscountType(t)}
                className="px-4 py-1.5 cursor-pointer transition-colors"
                style={
                  siblingDiscountType === t
                    ? { background: '#1a2535', color: 'white' }
                    : { background: 'white', color: '#6b7280' }
                }
              >
                {t === 'fixed' ? '고정 금액(원)' : '비율(%)'}
              </button>
            ))}
          </div>

          <label className="text-[12px] font-medium text-[#374151] block mt-3">
            할인 {siblingDiscountType === 'fixed' ? '금액' : '비율'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={siblingDiscountType === 'percent' ? 100 : undefined}
              step={siblingDiscountType === 'percent' ? 1 : 1000}
              value={siblingDiscountInput}
              onChange={(e) => setSiblingDiscountInput(e.target.value)}
              className="w-40 border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
              placeholder="0"
            />
            <span className="text-[12px] text-[#6b7280]">{siblingDiscountType === 'fixed' ? '원' : '%'}</span>
          </div>
          {(siblingDiscount !== parseInt(siblingDiscountInput, 10) || siblingDiscountType !== siblingDiscountTypeSaved) && !isNaN(parseInt(siblingDiscountInput, 10)) && (
            <p className="text-[11px] text-[#f59e0b]">저장하지 않은 변경사항이 있습니다.</p>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={saveBillingSettings}
          disabled={savingBilling}
        >
          {savingBilling ? '저장 중…' : '저장 및 전체 적용'}
        </Button>
      </div>

      {/* 월별 조정 명칭 사전 */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag size={14} className="text-[#4fc3a1]" />
          <span className="text-[13px] font-semibold text-[#111827]">월별 조정 명칭 사전</span>
        </div>
        <p className="text-[11.5px] text-[#6b7280] mb-4">
          청구 화면에서 월별 조정을 추가할 때 드롭다운에 표시되는 명칭 목록입니다.
          예) 교재비, 활동비, 특강비, 모의고사비.
        </p>

        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {labels.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[20px] bg-[#f4f6f8] text-[12px] text-[#374151]"
              >
                {l.name}
                <button
                  onClick={() => deleteLabel(l.id)}
                  className="text-[#9ca3af] hover:text-red-500 cursor-pointer ml-0.5"
                  title="삭제"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addLabel(); }}
            maxLength={30}
            placeholder="새 명칭 (예: 교재비)"
            className="flex-1 max-w-[200px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
          />
          <Button variant="primary" size="sm" onClick={addLabel} disabled={!newLabel.trim()}>
            <Plus size={12} className="mr-1" /> 추가
          </Button>
        </div>
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
