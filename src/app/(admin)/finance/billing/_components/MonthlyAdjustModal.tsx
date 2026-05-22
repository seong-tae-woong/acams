'use client';
import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { formatMonth } from '../_shared';

interface ClassOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
}

interface ExistingAdjustment {
  id: string;
  scope: string;
  classId: string | null;
  className: string | null;
  studentId: string | null;
  studentName: string | null;
  label: string;
  direction: 'discount' | 'add';
  amount: number;
  memo: string;
}

interface LabelItem {
  id: string;
  name: string;
}

interface MonthlyAdjustModalProps {
  open: boolean;
  onClose: () => void;
  billingMonth: string;          // "YYYY-MM"
  classes: ClassOption[];
  /** 반별 활성 학생 — { classId → StudentOption[] } */
  studentsByClass: Record<string, StudentOption[]>;
  /** 저장 성공 시 부모에서 청구서 목록 새로고침 */
  onSaved: () => void;
}

export default function MonthlyAdjustModal({
  open, onClose, billingMonth, classes, studentsByClass, onSaved,
}: MonthlyAdjustModalProps) {
  // 폼 상태
  const [classId, setClassId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [labelMode, setLabelMode] = useState<'preset' | 'custom'>('preset');
  const [presetLabel, setPresetLabel] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [direction, setDirection] = useState<'add' | 'discount'>('add');
  const [amountInput, setAmountInput] = useState('');
  const [memo, setMemo] = useState('');
  const [saveCustomLabel, setSaveCustomLabel] = useState(true);

  // 명칭 사전 + 이번 달 기존 조정
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [existingAdjustments, setExistingAdjustments] = useState<ExistingAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 모달 열릴 때 초기화 + 데이터 로드
  useEffect(() => {
    if (!open) return;
    setClassId('');
    setSelectedStudentIds(new Set());
    setLabelMode('preset');
    setPresetLabel('');
    setCustomLabel('');
    setDirection('add');
    setAmountInput('');
    setMemo('');
    setSaveCustomLabel(true);

    setLoading(true);
    Promise.all([
      fetch('/api/finance/adjustments/labels').then((r) => r.ok ? r.json() : []),
      fetch(`/api/finance/adjustments/monthly?billingMonth=${billingMonth}`).then((r) => r.ok ? r.json() : []),
    ]).then(([labelData, adjData]) => {
      setLabels(labelData as LabelItem[]);
      setExistingAdjustments(adjData as ExistingAdjustment[]);
      // 명칭이 있고 preset 모드 기본 선택
      if ((labelData as LabelItem[]).length > 0) {
        setPresetLabel((labelData as LabelItem[])[0].name);
      } else {
        setLabelMode('custom');
      }
    }).finally(() => setLoading(false));
  }, [open, billingMonth]);

  // 반 변경 시 — 해당 반의 모든 학생을 기본 선택
  function changeClass(newClassId: string) {
    setClassId(newClassId);
    const students = studentsByClass[newClassId] ?? [];
    setSelectedStudentIds(new Set(students.map((s) => s.id)));
  }

  const studentsForClass = useMemo(
    () => (classId ? (studentsByClass[classId] ?? []) : []),
    [classId, studentsByClass],
  );

  function toggleStudent(sid: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }

  function toggleAllStudents() {
    if (selectedStudentIds.size === studentsForClass.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(studentsForClass.map((s) => s.id)));
    }
  }

  async function handleSave() {
    if (!classId) { toast('반을 선택하세요.', 'error'); return; }
    if (selectedStudentIds.size === 0) { toast('학생을 1명 이상 선택하세요.', 'error'); return; }

    const label = (labelMode === 'preset' ? presetLabel : customLabel).trim();
    if (!label) { toast('명칭을 선택하거나 입력하세요.', 'error'); return; }

    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount <= 0) { toast('금액은 양수여야 합니다.', 'error'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/finance/adjustments/monthly/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingMonth,
          classId,
          studentIds: Array.from(selectedStudentIds),
          label,
          direction,
          amount,
          memo,
          saveLabel: labelMode === 'custom' && saveCustomLabel,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast(err.error || '저장 실패', 'error');
        return;
      }

      const data = await res.json() as { created: number; skipped: number };
      const skipMsg = data.skipped > 0 ? ` (중복 ${data.skipped}건 건너뜀)` : '';
      toast(`${data.created}건 추가됨${skipMsg}`, 'success');

      // 명칭 사전이 갱신될 수 있으므로 재조회
      if (labelMode === 'custom' && saveCustomLabel) {
        const updated = await fetch('/api/finance/adjustments/labels').then((r) => r.ok ? r.json() : []);
        setLabels(updated as LabelItem[]);
      }
      // 기존 조정 목록 재조회
      const adjRes = await fetch(`/api/finance/adjustments/monthly?billingMonth=${billingMonth}`);
      if (adjRes.ok) setExistingAdjustments((await adjRes.json()) as ExistingAdjustment[]);

      onSaved();
      // 폼 일부 초기화 (반·학생 유지, 명칭·금액만 리셋해 연속 입력 편의)
      setCustomLabel('');
      setAmountInput('');
      setMemo('');
    } catch {
      toast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(adjId: string) {
    if (!confirm('이 조정 항목을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/finance/adjustments/monthly/${adjId}`, { method: 'DELETE' });
      if (!res.ok) { toast('삭제 실패', 'error'); return; }
      setExistingAdjustments((prev) => prev.filter((a) => a.id !== adjId));
      toast('삭제되었습니다.', 'success');
      onSaved();
    } catch {
      toast('삭제 실패', 'error');
    }
  }

  const allSelected = studentsForClass.length > 0 && selectedStudentIds.size === studentsForClass.length;
  const someSelected = selectedStudentIds.size > 0 && !allSelected;

  return (
    <Modal open={open} onClose={onClose} title={`${formatMonth(billingMonth)} 월별 조정 관리`} size="lg">
      {loading ? (
        <div className="py-10 text-center text-[#9ca3af]">불러오는 중…</div>
      ) : (
        <div className="space-y-5">
          {/* ── 기존 조정 목록 ───────────────────────────────────── */}
          <div>
            <div className="text-[12.5px] font-semibold text-[#111827] mb-2">
              이번 달 등록된 조정 ({existingAdjustments.length}건)
            </div>
            {existingAdjustments.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af]">등록된 조정 없음</p>
            ) : (
              <div className="max-h-[160px] overflow-y-auto border border-[#e2e8f0] rounded-[8px] divide-y divide-[#f1f5f9]">
                {existingAdjustments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px]"
                        style={
                          a.direction === 'discount'
                            ? { background: '#FEE2E2', color: '#991B1B' }
                            : { background: '#D1FAE5', color: '#065f46' }
                        }
                      >
                        {a.direction === 'discount' ? '할인' : '추가'}
                      </span>
                      <span className="text-[12px] font-medium text-[#111827]">{a.label}</span>
                      <span className="text-[12px] text-[#6b7280]">
                        {a.amount.toLocaleString()}원
                      </span>
                      <span className="text-[11.5px] text-[#6b7280] truncate">
                        {a.scope === 'class' && a.className ? `반: ${a.className}` : ''}
                        {a.scope === 'student' && a.studentName ? `학생: ${a.studentName}` : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-[#9ca3af] hover:text-red-500 cursor-pointer ml-2 shrink-0"
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#e2e8f0]" />

          {/* ── 새 조정 추가 ───────────────────────────────────── */}
          <div>
            <div className="text-[12.5px] font-semibold text-[#111827] mb-3">새 조정 추가</div>

            {/* 반 선택 */}
            <div className="space-y-1 mb-3">
              <label className="text-[11.5px] font-medium text-[#6b7280]">반 선택</label>
              <div className="relative">
                <select
                  value={classId}
                  onChange={(e) => changeClass(e.target.value)}
                  className="w-full appearance-none border border-[#e2e8f0] rounded-[8px] pl-3 pr-8 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1] cursor-pointer"
                >
                  <option value="">반을 선택하세요</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
              </div>
            </div>

            {/* 학생 다중 선택 — 반 선택 후에만 표시 */}
            {classId && (
              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] font-medium text-[#6b7280]">
                    학생 선택 ({selectedStudentIds.size}/{studentsForClass.length})
                  </label>
                  <button
                    onClick={toggleAllStudents}
                    className="text-[11.5px] text-[#4fc3a1] hover:underline cursor-pointer"
                  >
                    {allSelected ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                {studentsForClass.length === 0 ? (
                  <p className="text-[12px] text-[#9ca3af] py-3 text-center bg-[#f9fafb] rounded-[8px]">
                    이 반에 활성 학생이 없습니다.
                  </p>
                ) : (
                  <div className="max-h-[140px] overflow-y-auto border border-[#e2e8f0] rounded-[8px] p-2 grid grid-cols-3 gap-1">
                    {studentsForClass.map((s) => {
                      const checked = selectedStudentIds.has(s.id);
                      return (
                        <label
                          key={s.id}
                          className={clsx(
                            'flex items-center gap-1.5 px-2 py-1 rounded-[6px] cursor-pointer text-[12px] transition-colors',
                            checked ? 'bg-[#EEF2FF] text-[#1a2535]' : 'hover:bg-[#f9fafb] text-[#374151]',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudent(s.id)}
                            ref={(el) => { if (el && allSelected === false) el.indeterminate = false; if (el && someSelected) el.indeterminate = false; }}
                            className="w-3.5 h-3.5 accent-[#4fc3a1] cursor-pointer"
                          />
                          <span className="truncate">{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 명칭 — preset / custom 토글 */}
            <div className="space-y-1 mb-3">
              <label className="text-[11.5px] font-medium text-[#6b7280]">명칭</label>
              <div className="flex rounded-[8px] border border-[#e2e8f0] overflow-hidden text-[12px] font-medium w-fit mb-1.5">
                {(['preset', 'custom'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setLabelMode(m)}
                    className="px-3 py-1 cursor-pointer transition-colors"
                    style={
                      labelMode === m
                        ? { background: '#1a2535', color: 'white' }
                        : { background: 'white', color: '#6b7280' }
                    }
                  >
                    {m === 'preset' ? '사전에서 선택' : '직접 입력'}
                  </button>
                ))}
              </div>
              {labelMode === 'preset' ? (
                labels.length === 0 ? (
                  <p className="text-[11.5px] text-[#f59e0b]">
                    등록된 명칭이 없습니다. 설정 → 학원 탭에서 추가하거나 [직접 입력]을 사용하세요.
                  </p>
                ) : (
                  <div className="relative">
                    <select
                      value={presetLabel}
                      onChange={(e) => setPresetLabel(e.target.value)}
                      className="w-full appearance-none border border-[#e2e8f0] rounded-[8px] pl-3 pr-8 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1] cursor-pointer"
                    >
                      {labels.map((l) => (
                        <option key={l.id} value={l.name}>{l.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                  </div>
                )
              ) : (
                <>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    maxLength={30}
                    placeholder="예: 12월 교재비"
                    className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
                  />
                  <label className="flex items-center gap-1.5 text-[11.5px] text-[#6b7280] cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={saveCustomLabel}
                      onChange={(e) => setSaveCustomLabel(e.target.checked)}
                      className="w-3 h-3 accent-[#4fc3a1] cursor-pointer"
                    />
                    이 명칭을 사전에 저장 (다음에도 빠르게 선택)
                  </label>
                </>
              )}
            </div>

            {/* 방향 + 금액 */}
            <div className="flex gap-2 mb-3">
              <div className="space-y-1">
                <label className="text-[11.5px] font-medium text-[#6b7280]">방향</label>
                <div className="flex rounded-[8px] border border-[#e2e8f0] overflow-hidden text-[12px] font-medium">
                  {(['add', 'discount'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      className="px-3 py-2 cursor-pointer transition-colors"
                      style={
                        direction === d
                          ? d === 'add'
                            ? { background: '#D1FAE5', color: '#065f46' }
                            : { background: '#FEE2E2', color: '#991B1B' }
                          : { background: 'white', color: '#6b7280' }
                      }
                    >
                      {d === 'add' ? '추가' : '할인'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-[11.5px] font-medium text-[#6b7280]">금액(원)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
                />
              </div>
            </div>

            {/* 메모 */}
            <div className="space-y-1 mb-3">
              <label className="text-[11.5px] font-medium text-[#6b7280]">메모 (선택)</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 12월 교재 배포"
                className="w-full border border-[#e2e8f0] rounded-[8px] px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
              <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                <Check size={12} className="mr-1" /> {saving ? '저장 중…' : `${selectedStudentIds.size}명에게 추가`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
