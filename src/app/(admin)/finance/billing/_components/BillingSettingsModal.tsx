'use client';
import { useState, useEffect } from 'react';
import { Tag, X, Plus, Users } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

interface BillingSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = 'sibling' | 'labels';

export default function BillingSettingsModal({ open, onClose }: BillingSettingsModalProps) {
  const [tab, setTab] = useState<TabKey>('sibling');

  // 형제 할인 상태
  const [siblingDiscount, setSiblingDiscount] = useState(0);
  const [siblingDiscountInput, setSiblingDiscountInput] = useState('0');
  const [siblingDiscountType, setSiblingDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [siblingDiscountTypeSaved, setSiblingDiscountTypeSaved] = useState<'fixed' | 'percent'>('fixed');
  const [savingSibling, setSavingSibling] = useState(false);

  // 명칭 사전 상태
  const [labels, setLabels] = useState<{ id: string; name: string }[]>([]);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    fetch('/api/finance/settings')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const v = data.siblingDiscountDefault ?? 0;
        const t = data.siblingDiscountType ?? 'fixed';
        setSiblingDiscount(v);
        setSiblingDiscountInput(String(v));
        setSiblingDiscountType(t);
        setSiblingDiscountTypeSaved(t);
      });
    fetch('/api/finance/adjustments/labels')
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => setLabels(data));
  }, [open]);

  async function saveSiblingSettings() {
    const amount = parseInt(siblingDiscountInput, 10);
    if (isNaN(amount) || amount < 0) {
      toast('할인 금액은 0 이상의 숫자여야 합니다.', 'error');
      return;
    }
    if (siblingDiscountType === 'percent' && amount > 100) {
      toast('퍼센트 할인은 100을 초과할 수 없습니다.', 'error');
      return;
    }
    setSavingSibling(true);
    try {
      const res = await fetch('/api/finance/settings', {
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
      toast('저장 완료. 모든 형제 학생에 자동 반영되었습니다.', 'success');
    } catch (e) {
      toast((e as Error).message || '저장 실패', 'error');
    } finally {
      setSavingSibling(false);
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
      if (!res.ok) { toast('삭제 실패', 'error'); return; }
      setLabels((prev) => prev.filter((l) => l.id !== id));
      toast('명칭이 삭제되었습니다.', 'success');
    } catch {
      toast('삭제 실패', 'error');
    }
  }

  const siblingDirty =
    siblingDiscount !== parseInt(siblingDiscountInput, 10) ||
    siblingDiscountType !== siblingDiscountTypeSaved;

  return (
    <Modal open={open} onClose={onClose} title="청구 설정" size="md">
      {/* 탭 헤더 */}
      <div className="flex gap-1 mb-4 border-b border-[#e2e8f0]">
        {([
          { key: 'sibling', label: '형제 할인 자동 적용', Icon: Users },
          { key: 'labels',  label: '조정 명칭 사전',     Icon: Tag },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer -mb-px',
              tab === key
                ? 'border-[#4fc3a1] text-[#111827]'
                : 'border-transparent text-[#6b7280] hover:text-[#374151]',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* 형제 할인 탭 */}
      {tab === 'sibling' && (
        <div className="space-y-4">
          <p className="text-[12px] text-[#6b7280]">
            학원에 형제·자매가 함께 재원 중인 학생에게 자동으로 적용되는 할인입니다.
            저장 시 현재 재원생 전체에 즉시 반영되며, 새 학생 추가 또는 형제 관계 변경 시에도 자동으로 동기화됩니다.
          </p>

          <div className="space-y-2">
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
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-[#374151]">
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
            {siblingDirty && !isNaN(parseInt(siblingDiscountInput, 10)) && (
              <p className="text-[11px] text-[#f59e0b]">저장하지 않은 변경사항이 있습니다.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#f1f5f9]">
            <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
            <Button variant="primary" size="sm" onClick={saveSiblingSettings} disabled={savingSibling}>
              {savingSibling ? '저장 중…' : '저장 및 전체 적용'}
            </Button>
          </div>
        </div>
      )}

      {/* 명칭 사전 탭 */}
      {tab === 'labels' && (
        <div className="space-y-4">
          <p className="text-[12px] text-[#6b7280]">
            월별 조정을 추가할 때 드롭다운에 표시되는 명칭 목록입니다. (예: 교재비, 활동비, 특강비, 모의고사비)
          </p>

          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
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
              className="flex-1 max-w-[260px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
            />
            <Button variant="primary" size="sm" onClick={addLabel} disabled={!newLabel.trim()}>
              <Plus size={12} className="mr-1" /> 추가
            </Button>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#f1f5f9]">
            <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
