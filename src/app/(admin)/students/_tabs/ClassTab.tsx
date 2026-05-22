'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useClassStore } from '@/lib/stores/classStore';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Student } from '@/lib/types/student';
import { toast } from '@/lib/stores/toastStore';
import Button from '@/components/shared/Button';

interface EnrollmentRule {
  id: string;
  enrollmentId: string;
  label: string;
  direction: 'discount' | 'add';
  amountType: 'fixed' | 'percent';
  amount: number;
  memo: string;
}

interface ClassRulesState {
  enrollmentId: string | null;
  rules: EnrollmentRule[];
  loading: boolean;
  expanded: boolean;
}

export default function ClassTab({ student }: { student: Student }) {
  const { classes } = useClassStore();
  const { currentUser } = useAuthStore();
  const isDirector = currentUser?.role === 'director' || currentUser?.role === 'super_admin';

  const studentClasses = classes.filter((c) => student.classes.includes(c.id));

  // 반별 규칙 상태 맵 (classId → state)
  const [rulesMap, setRulesMap] = useState<Record<string, ClassRulesState>>({});

  // 반별 인라인 추가 폼 상태
  const [addForms, setAddForms] = useState<Record<string, {
    label: string;
    direction: 'discount' | 'add';
    amountType: 'fixed' | 'percent';
    amount: string;
    memo: string;
    saving: boolean;
  }>>({});

  // 카드 토글 — 첫 열기 시 규칙 로드
  const toggleExpand = useCallback(async (classId: string) => {
    const current = rulesMap[classId];

    if (current?.expanded) {
      setRulesMap((prev) => ({ ...prev, [classId]: { ...prev[classId], expanded: false } }));
      return;
    }

    // 아직 로드하지 않은 경우 fetch
    if (!current) {
      setRulesMap((prev) => ({
        ...prev,
        [classId]: { enrollmentId: null, rules: [], loading: true, expanded: true },
      }));
      setAddForms((prev) => ({
        ...prev,
        [classId]: { label: '', direction: 'discount', amountType: 'fixed', amount: '', memo: '', saving: false },
      }));

      try {
        const res = await fetch(
          `/api/finance/adjustments/enrollment-rules?studentId=${student.id}&classId=${classId}`,
        );
        if (res.ok) {
          const data = await res.json() as { enrollmentId: string | null; rules: EnrollmentRule[] };
          setRulesMap((prev) => ({
            ...prev,
            [classId]: { enrollmentId: data.enrollmentId, rules: data.rules, loading: false, expanded: true },
          }));
        }
      } catch {
        setRulesMap((prev) => ({ ...prev, [classId]: { enrollmentId: null, rules: [], loading: false, expanded: true } }));
      }
    } else {
      setRulesMap((prev) => ({ ...prev, [classId]: { ...prev[classId], expanded: true } }));
    }
  }, [rulesMap, student.id]);

  // 규칙 삭제
  async function deleteRule(classId: string, ruleId: string) {
    const state = rulesMap[classId];
    if (!state) return;

    setRulesMap((prev) => ({
      ...prev,
      [classId]: { ...prev[classId], rules: prev[classId].rules.filter((r) => r.id !== ruleId) },
    }));

    try {
      const res = await fetch(`/api/finance/adjustments/enrollment-rules/${ruleId}`, { method: 'DELETE' });
      if (!res.ok) {
        // 롤백
        const data = await fetch(
          `/api/finance/adjustments/enrollment-rules?studentId=${student.id}&classId=${classId}`,
        ).then((r) => r.json()) as { rules: EnrollmentRule[] };
        setRulesMap((prev) => ({ ...prev, [classId]: { ...prev[classId], rules: data.rules } }));
        toast('삭제 실패', 'error');
      } else {
        toast('규칙이 삭제되었습니다.', 'success');
      }
    } catch {
      toast('삭제 실패', 'error');
    }
  }

  // 규칙 추가
  async function addRule(classId: string) {
    const form = addForms[classId];
    const state = rulesMap[classId];
    if (!form || !state) return;

    const amount = parseFloat(form.amount);
    if (!form.label.trim()) { toast('항목명을 입력하세요.', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { toast('금액은 양수여야 합니다.', 'error'); return; }
    if (form.amountType === 'percent' && amount > 100) { toast('퍼센트는 100을 초과할 수 없습니다.', 'error'); return; }
    if (!state.enrollmentId) { toast('수강 등록 정보를 찾을 수 없습니다.', 'error'); return; }

    setAddForms((prev) => ({ ...prev, [classId]: { ...prev[classId], saving: true } }));

    try {
      const res = await fetch('/api/finance/adjustments/enrollment-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: state.enrollmentId,
          label: form.label.trim(),
          direction: form.direction,
          amountType: form.amountType,
          amount: Math.round(amount),
          memo: form.memo.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast(err.error || '추가 실패', 'error');
      } else {
        const newRule = await res.json() as EnrollmentRule;
        setRulesMap((prev) => ({
          ...prev,
          [classId]: { ...prev[classId], rules: [...prev[classId].rules, newRule] },
        }));
        setAddForms((prev) => ({
          ...prev,
          [classId]: { label: '', direction: 'discount', amountType: 'fixed', amount: '', memo: '', saving: false },
        }));
        toast('규칙이 추가되었습니다.', 'success');
      }
    } catch {
      toast('추가 실패', 'error');
    } finally {
      setAddForms((prev) => ({ ...prev, [classId]: { ...prev[classId], saving: false } }));
    }
  }

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
      <div className="text-[12.5px] font-semibold text-[#111827] mb-3">수강 중인 반</div>
      {studentClasses.length === 0 ? (
        <p className="text-[12px] text-[#9ca3af]">배정된 반 없음</p>
      ) : (
        <div className="space-y-2">
          {studentClasses.map((cls) => {
            const state = rulesMap[cls.id];
            const form = addForms[cls.id];

            return (
              <div key={cls.id} className="border border-[#e2e8f0] rounded-[8px] overflow-hidden">
                {/* 반 헤더 */}
                <button
                  onClick={() => toggleExpand(cls.id)}
                  className="w-full flex items-center justify-between p-3 bg-[#f4f6f8] hover:bg-[#eef0f3] transition-colors text-left cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                      <span className="text-[13px] font-medium text-[#111827]">{cls.name}</span>
                    </div>
                    <div className="text-[11.5px] text-[#6b7280] mt-0.5 ml-4">
                      {cls.teacherName} ·{' '}
                      {cls.schedule.map((s) => `${['','월','화','수','목','금','토','일'][s.dayOfWeek]}${s.startTime}`).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[12px] text-[#6b7280]">{cls.fee.toLocaleString()}원/월</span>
                    {state?.expanded
                      ? <ChevronUp size={13} className="text-[#9ca3af]" />
                      : <ChevronDown size={13} className="text-[#9ca3af]" />
                    }
                  </div>
                </button>

                {/* 확장 영역 — 수강 등록 규칙 */}
                {state?.expanded && (
                  <div className="p-3 bg-white border-t border-[#f1f5f9]">
                    <div className="text-[11.5px] font-semibold text-[#6b7280] mb-2">수강별 할인 · 추가 규칙</div>

                    {state.loading ? (
                      <p className="text-[12px] text-[#9ca3af]">불러오는 중…</p>
                    ) : state.rules.length === 0 ? (
                      <p className="text-[12px] text-[#9ca3af] mb-2">등록된 규칙 없음</p>
                    ) : (
                      <div className="space-y-1.5 mb-3">
                        {state.rules.map((rule) => (
                          <div
                            key={rule.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-[6px] bg-[#f9fafb] border border-[#f1f5f9]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px]"
                                style={
                                  rule.direction === 'discount'
                                    ? { background: '#FEE2E2', color: '#991B1B' }
                                    : { background: '#D1FAE5', color: '#065f46' }
                                }
                              >
                                {rule.direction === 'discount' ? '할인' : '추가'}
                              </span>
                              <span className="text-[12px] text-[#374151] truncate">{rule.label}</span>
                              <span className="text-[12px] text-[#6b7280] shrink-0">
                                {rule.amountType === 'percent'
                                  ? `${rule.amount}%`
                                  : `${rule.amount.toLocaleString()}원`}
                              </span>
                            </div>
                            {isDirector && (
                              <button
                                onClick={() => deleteRule(cls.id, rule.id)}
                                className="text-[#9ca3af] hover:text-red-500 transition-colors cursor-pointer ml-2 shrink-0"
                                title="삭제"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 인라인 추가 폼 — 원장만 */}
                    {isDirector && form && (
                      <div className="border border-dashed border-[#e2e8f0] rounded-[8px] p-2.5 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 항목명 */}
                          <input
                            type="text"
                            placeholder="항목명 (예: 형제 할인)"
                            value={form.label}
                            onChange={(e) => setAddForms((p) => ({ ...p, [cls.id]: { ...p[cls.id], label: e.target.value } }))}
                            className="flex-1 min-w-[120px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
                          />
                          {/* 방향 토글 */}
                          <div className="flex rounded-[6px] border border-[#e2e8f0] overflow-hidden text-[11.5px] font-medium">
                            {(['discount', 'add'] as const).map((dir) => (
                              <button
                                key={dir}
                                onClick={() => setAddForms((p) => ({ ...p, [cls.id]: { ...p[cls.id], direction: dir } }))}
                                className="px-2.5 py-1 cursor-pointer transition-colors"
                                style={
                                  form.direction === dir
                                    ? dir === 'discount'
                                      ? { background: '#FEE2E2', color: '#991B1B' }
                                      : { background: '#D1FAE5', color: '#065f46' }
                                    : { background: 'white', color: '#6b7280' }
                                }
                              >
                                {dir === 'discount' ? '할인' : '추가'}
                              </button>
                            ))}
                          </div>
                          {/* 금액 */}
                          <input
                            type="number"
                            min={0}
                            placeholder="금액"
                            value={form.amount}
                            onChange={(e) => setAddForms((p) => ({ ...p, [cls.id]: { ...p[cls.id], amount: e.target.value } }))}
                            className="w-24 border border-[#e2e8f0] rounded-[6px] px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
                          />
                          {/* 타입 토글 */}
                          <div className="flex rounded-[6px] border border-[#e2e8f0] overflow-hidden text-[11.5px] font-medium">
                            {(['fixed', 'percent'] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => setAddForms((p) => ({ ...p, [cls.id]: { ...p[cls.id], amountType: t } }))}
                                className="px-2.5 py-1 cursor-pointer transition-colors"
                                style={
                                  form.amountType === t
                                    ? { background: '#EEF2FF', color: '#4338CA' }
                                    : { background: 'white', color: '#6b7280' }
                                }
                              >
                                {t === 'fixed' ? '원' : '%'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="메모 (선택)"
                            value={form.memo}
                            onChange={(e) => setAddForms((p) => ({ ...p, [cls.id]: { ...p[cls.id], memo: e.target.value } }))}
                            className="flex-1 border border-[#e2e8f0] rounded-[6px] px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#4fc3a1]"
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => addRule(cls.id)}
                            disabled={form.saving}
                          >
                            <Plus size={12} className="mr-1" />
                            {form.saving ? '추가 중…' : '추가'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
