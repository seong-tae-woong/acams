'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, EyeOff, RotateCcw } from 'lucide-react';
import Button from '@/components/shared/Button';
import { useLessonStore } from '@/lib/stores/lessonStore';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import { ATTITUDE_LABELS } from '@/lib/types/lesson';
import type { ClinicCheck, ClinicCustomItem } from '@/lib/types/lesson';

/**
 * Comment + Clinic 입력 패널 (정규 수업 / 보강 공용)
 *
 * scope.kind === 'lesson'  → (classId, sessionDate) 키로 LessonComment / ClinicResult 사용
 * scope.kind === 'makeup'  → (makeupClassId) 키로 MakeupComment / MakeupClinicResult 사용
 *
 * 학생 목록과 학생 선택은 상위 컴포넌트가 책임지고, 이 패널은 선택된 학생에 대한
 * 입력 영역만 담당. 양 모드에서 동일한 UI가 보장됨.
 */

export type CommentClinicScope =
  | { kind: 'lesson'; classId: string; sessionDate: string }
  | { kind: 'makeup'; makeupClassId: string };

interface CommentClinicPanelProps {
  scope: CommentClinicScope;
  selectedStudentId: string | null;
}

export default function CommentClinicPanel({ scope, selectedStudentId }: CommentClinicPanelProps) {
  const {
    templates,
    fetchTemplates,
    // lesson
    fetchComments,
    upsertComment,
    fetchClinicResults,
    upsertClinicResult,
    getCommentFor,
    getClinicResultFor,
    comments,
    clinicResults,
    // 수업 평가 (태도·과제)
    fetchStudentEvals,
    upsertStudentEval,
    getStudentEvalFor,
    studentEvals,
    // makeup
    fetchMakeupComments,
    upsertMakeupComment,
    fetchMakeupClinicResults,
    upsertMakeupClinicResult,
    getMakeupCommentFor,
    getMakeupClinicResultFor,
    makeupComments,
    makeupClinicResults,
  } = useLessonStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [commentText, setCommentText] = useState('');
  const [localChecks, setLocalChecks] = useState<ClinicCheck[]>([]);
  const [localCustomItems, setLocalCustomItems] = useState<ClinicCustomItem[]>([]);
  const [localHiddenItemIds, setLocalHiddenItemIds] = useState<string[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [saving, setSaving] = useState(false);

  // 수업 평가 (태도·과제) — 정규 수업(lesson scope) 전용
  const [attitude, setAttitude] = useState<number | null>(null);
  const [homeworkDone, setHomeworkDone] = useState<boolean | null>(null);
  const [attitudeReason, setAttitudeReason] = useState('');

  // scope의 식별 키 (useEffect deps용 안정값)
  const scopeKey = useMemo(() => {
    return scope.kind === 'lesson'
      ? `lesson:${scope.classId}:${scope.sessionDate}`
      : `makeup:${scope.makeupClassId}`;
  }, [scope]);

  // 양식 로드
  useEffect(() => {
    fetchTemplates().catch(() => {});
  }, [fetchTemplates]);

  // 데이터 fetch (scope 변경 시)
  useEffect(() => {
    if (scope.kind === 'lesson') {
      fetchComments(scope.classId, scope.sessionDate).catch(() => {});
      fetchClinicResults(scope.classId, scope.sessionDate).catch(() => {});
      fetchStudentEvals(scope.classId, scope.sessionDate).catch(() => {});
    } else {
      fetchMakeupComments(scope.makeupClassId).catch(() => {});
      fetchMakeupClinicResults(scope.makeupClassId).catch(() => {});
    }
    // scopeKey가 scope의 모든 식별 필드를 인코딩하므로, 불안정한 scope 객체는 deps에서 제외 (재렌더 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, fetchComments, fetchClinicResults, fetchStudentEvals, fetchMakeupComments, fetchMakeupClinicResults]);

  // 학생/scope 변경 시 수업 평가 복원 (lesson scope 전용)
  useEffect(() => {
    if (scope.kind !== 'lesson' || !selectedStudentId) {
      setAttitude(null);
      setHomeworkDone(null);
      setAttitudeReason('');
      return;
    }
    const e = getStudentEvalFor(scope.classId, selectedStudentId, scope.sessionDate);
    setAttitude(e?.attitude ?? null);
    setHomeworkDone(e?.homeworkDone ?? null);
    setAttitudeReason(e?.attitudeReason ?? '');
    // scope 객체는 매 렌더 새로 생성되므로 안정값 scopeKey만 의존 (입력값 초기화 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, scopeKey, studentEvals, getStudentEvalFor]);

  // 양식 선택: 학생에게 이미 저장된 클리닉이 있으면 그 양식을 자동 선택, 없으면 빈 상태로 시작
  useEffect(() => {
    if (!selectedStudentId) {
      setSelectedTemplateId('');
      return;
    }
    const rows =
      scope.kind === 'lesson'
        ? clinicResults.filter(
            (r) =>
              r.classId === scope.classId &&
              r.studentId === selectedStudentId &&
              r.sessionDate === scope.sessionDate,
          )
        : makeupClinicResults.filter(
            (r) => r.makeupClassId === scope.makeupClassId && r.studentId === selectedStudentId,
          );
    // 저장된 양식 중 가장 최근 것 (현재 templates에 존재하는 것만)
    const existingTemplateId = [...rows]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .map((r) => r.templateId)
      .find((id) => templates.some((t) => t.id === id));
    setSelectedTemplateId(existingTemplateId ?? '');
    // scope 객체는 매 렌더 새로 생성되므로 안정값 scopeKey만 의존 (선택 초기화 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, scopeKey, clinicResults, makeupClinicResults, templates]);

  // 학생/scope 변경 시 코멘트 복원
  useEffect(() => {
    if (!selectedStudentId) {
      setCommentText('');
      return;
    }
    const c =
      scope.kind === 'lesson'
        ? getCommentFor(scope.classId, selectedStudentId, scope.sessionDate)?.comment
        : getMakeupCommentFor(scope.makeupClassId, selectedStudentId)?.comment;
    setCommentText(c ?? '');
    // scope 객체는 매 렌더 새로 생성되므로 안정값 scopeKey만 의존 (입력값 초기화 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedStudentId,
    scopeKey,
    comments,
    makeupComments,
    getCommentFor,
    getMakeupCommentFor,
  ]);

  // 학생/양식 변경 시 Clinic 상태 복원
  useEffect(() => {
    if (!selectedStudentId || !selectedTemplateId) {
      setLocalChecks([]);
      setLocalCustomItems([]);
      setLocalHiddenItemIds([]);
      return;
    }
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;
    const existing =
      scope.kind === 'lesson'
        ? getClinicResultFor(scope.classId, selectedStudentId, scope.sessionDate, selectedTemplateId)
        : getMakeupClinicResultFor(scope.makeupClassId, selectedStudentId, selectedTemplateId);
    if (existing) {
      setLocalChecks(existing.checks);
      setLocalCustomItems(existing.customItems ?? []);
      setLocalHiddenItemIds(existing.hiddenItemIds ?? []);
    } else {
      setLocalChecks(tmpl.items.map((it) => ({ itemId: it.id, checked: false })));
      setLocalCustomItems([]);
      setLocalHiddenItemIds([]);
    }
    // scope 객체는 매 렌더 새로 생성되므로 안정값 scopeKey만 의존 (체크 상태 초기화 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedStudentId,
    selectedTemplateId,
    scopeKey,
    templates,
    clinicResults,
    makeupClinicResults,
    getClinicResultFor,
    getMakeupClinicResultFor,
  ]);

  const toggleCheck = (itemId: string) => {
    setLocalChecks((prev) => {
      const idx = prev.findIndex((c) => c.itemId === itemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], checked: !next[idx].checked }; // comment 보존
        return next;
      }
      return [...prev, { itemId, checked: true }];
    });
  };

  // 항목별 피드백 입력 (체크 여부와 독립 — 체크 안 해도 코멘트만 남길 수 있음)
  const setCheckComment = (itemId: string, comment: string) => {
    setLocalChecks((prev) => {
      const idx = prev.findIndex((c) => c.itemId === itemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], comment };
        return next;
      }
      return [...prev, { itemId, checked: false, comment }];
    });
  };

  const toggleCustomCheck = (id: string) => {
    setLocalCustomItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)),
    );
  };

  const setCustomComment = (id: string, comment: string) => {
    setLocalCustomItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, comment } : c)),
    );
  };

  const hideTemplateItem = (itemId: string) => {
    setLocalHiddenItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
  };

  const unhideTemplateItem = (itemId: string) => {
    setLocalHiddenItemIds((prev) => prev.filter((id) => id !== itemId));
  };

  const addCustomItem = () => {
    const label = newItemLabel.trim();
    if (!label) {
      toast('항목명을 입력해 주세요.', 'error');
      return;
    }
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLocalCustomItems((prev) => [...prev, { id, label, checked: false }]);
    setNewItemLabel('');
  };

  const removeCustomItem = (id: string) => {
    setLocalCustomItems((prev) => prev.filter((c) => c.id !== id));
  };

  const currentTemplate = templates.find((t) => t.id === selectedTemplateId);
  const savedResult =
    selectedStudentId && selectedTemplateId
      ? scope.kind === 'lesson'
        ? getClinicResultFor(scope.classId, selectedStudentId, scope.sessionDate, selectedTemplateId)
        : getMakeupClinicResultFor(scope.makeupClassId, selectedStudentId, selectedTemplateId)
      : undefined;

  const handleSave = async () => {
    if (!selectedStudentId) {
      toast('학생을 선택해 주세요.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (scope.kind === 'lesson') {
        await upsertComment({
          classId: scope.classId,
          studentId: selectedStudentId,
          sessionDate: scope.sessionDate,
          comment: commentText,
        });
        await upsertStudentEval({
          classId: scope.classId,
          studentId: selectedStudentId,
          sessionDate: scope.sessionDate,
          attitude,
          attitudeReason: attitudeReason.trim() || null,
          homeworkDone,
        });
        if (selectedTemplateId && currentTemplate) {
          await upsertClinicResult({
            classId: scope.classId,
            studentId: selectedStudentId,
            sessionDate: scope.sessionDate,
            templateId: selectedTemplateId,
            checks: localChecks,
            customItems: localCustomItems,
            hiddenItemIds: localHiddenItemIds,
          });
        }
      } else {
        await upsertMakeupComment({
          makeupClassId: scope.makeupClassId,
          studentId: selectedStudentId,
          comment: commentText,
        });
        if (selectedTemplateId && currentTemplate) {
          await upsertMakeupClinicResult({
            makeupClassId: scope.makeupClassId,
            studentId: selectedStudentId,
            templateId: selectedTemplateId,
            checks: localChecks,
            customItems: localCustomItems,
            hiddenItemIds: localHiddenItemIds,
          });
        }
      }
      toast('저장되었습니다.', 'success');
    } catch {
      toast('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedStudentId) {
    return <div className="text-[13px] text-[#9ca3af]">학생을 선택해 주세요.</div>;
  }

  return (
    <div className="space-y-4">
      {/* 수업 평가 (태도·과제) — 정규 수업 전용 */}
      {scope.kind === 'lesson' && (
        <div className="rounded-[8px] border border-[#e2e8f0] bg-[#fafbfc] p-3 space-y-2.5">
          <div className="text-[12px] font-semibold text-[#111827]">수업 평가</div>

          {/* 태도 점수 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11.5px] text-[#6b7280] w-9 shrink-0">태도</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  title={ATTITUDE_LABELS[n]}
                  onClick={() => setAttitude(attitude === n ? null : n)}
                  className={clsx(
                    'w-8 h-8 rounded-[8px] text-[13px] font-semibold border transition-colors cursor-pointer',
                    attitude === n
                      ? 'bg-[#4fc3a1] text-white border-transparent'
                      : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f4f6f8]',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[#9ca3af]">
              {attitude ? ATTITUDE_LABELS[attitude] : '1 매우 미흡 · 5 매우 우수'}
            </span>
          </div>

          {/* 과제 수행 */}
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-[#6b7280] w-9 shrink-0">과제</span>
            <button
              type="button"
              onClick={() => setHomeworkDone(homeworkDone === true ? null : true)}
              className={clsx(
                'px-3 py-1 rounded-[8px] text-[12px] border transition-colors cursor-pointer',
                homeworkDone === true
                  ? 'bg-[#4fc3a1] text-white border-transparent'
                  : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f4f6f8]',
              )}
            >
              했음
            </button>
            <button
              type="button"
              onClick={() => setHomeworkDone(homeworkDone === false ? null : false)}
              className={clsx(
                'px-3 py-1 rounded-[8px] text-[12px] border transition-colors cursor-pointer',
                homeworkDone === false
                  ? 'bg-[#ef4444] text-white border-transparent'
                  : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f4f6f8]',
              )}
            >
              안 함
            </button>
            {homeworkDone === null && (
              <span className="text-[11px] text-[#9ca3af]">미설정 (과제 없던 날)</span>
            )}
          </div>

          {/* 사유 (선택) */}
          <input
            type="text"
            value={attitudeReason}
            onChange={(e) => setAttitudeReason(e.target.value)}
            placeholder="태도 점수 사유 (선택)"
            className="w-full text-[12px] border border-[#e2e8f0] rounded-[8px] px-3 py-1.5 focus:outline-none focus:border-[#4fc3a1]"
          />
        </div>
      )}

      {/* Comment */}
      <div>
        <label className="block text-[12px] font-semibold text-[#111827] mb-1.5">
          Clinic 전달 내용
        </label>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          rows={4}
          placeholder="Clinic 강사에게 전달할 학생별 내용(관찰·요청 등)을 입력하세요."
          className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] resize-none"
        />
      </div>

      {/* Clinic */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[12px] font-semibold text-[#111827]">Clinic 체크리스트</label>
          {templates.length > 0 && (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="text-[12px] border border-[#e2e8f0] rounded-[8px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
            >
              <option value="">양식 선택</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {templates.length === 0 ? (
          <div className="text-[12px] text-[#9ca3af] py-3 px-3 bg-[#f9fafb] rounded-[8px]">
            등록된 Clinic 양식이 없습니다. 수업 관리 화면에서 양식을 먼저 만들어 주세요.
          </div>
        ) : !currentTemplate ? null : (
          <div className="space-y-1.5 border border-[#e2e8f0] rounded-[8px] p-3">
            {/* 양식 항목 */}
            {[...currentTemplate.items]
              .sort((a, b) => a.order - b.order)
              .filter((item) => !localHiddenItemIds.includes(item.id))
              .map((item) => {
                const entry = localChecks.find((c) => c.itemId === item.id);
                const checked = entry?.checked ?? false;
                return (
                  <div
                    key={item.id}
                    className="group text-[12.5px] text-[#374151] hover:bg-[#f9fafb] px-1.5 py-1 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheck(item.id)}
                          className="cursor-pointer accent-[#4fc3a1]"
                        />
                        <span>{item.label}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => hideTemplateItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#9ca3af] hover:text-[#ef4444] transition-opacity cursor-pointer"
                        title="이 수업에서만 숨기기"
                      >
                        <EyeOff size={13} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={entry?.comment ?? ''}
                      onChange={(e) => setCheckComment(item.id, e.target.value)}
                      placeholder="피드백 (선택)"
                      className="mt-1 ml-6 w-[calc(100%-1.5rem)] text-[11.5px] border border-[#e2e8f0] rounded-[6px] px-2 py-0.5 focus:outline-none focus:border-[#4fc3a1]"
                    />
                  </div>
                );
              })}

            {/* 커스텀 항목 */}
            {localCustomItems.map((item) => (
              <div
                key={item.id}
                className="group text-[12.5px] text-[#374151] hover:bg-[#f9fafb] px-1.5 py-1 rounded"
              >
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleCustomCheck(item.id)}
                      className="cursor-pointer accent-[#4fc3a1]"
                    />
                    <span>{item.label}</span>
                    <span className="text-[10.5px] text-[#a78bfa]">(이 수업)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCustomItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#9ca3af] hover:text-[#ef4444] transition-opacity cursor-pointer"
                    title="이 항목 삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <input
                  type="text"
                  value={item.comment ?? ''}
                  onChange={(e) => setCustomComment(item.id, e.target.value)}
                  placeholder="피드백 (선택)"
                  className="mt-1 ml-6 w-[calc(100%-1.5rem)] text-[11.5px] border border-[#e2e8f0] rounded-[6px] px-2 py-0.5 focus:outline-none focus:border-[#4fc3a1]"
                />
              </div>
            ))}

            {/* 숨긴 항목 복원 */}
            {localHiddenItemIds.length > 0 && (
              <div className="pt-2 mt-2 border-t border-[#f1f5f9]">
                <div className="text-[10.5px] text-[#9ca3af] mb-1">숨긴 양식 항목 (이 수업)</div>
                <div className="flex flex-wrap gap-1.5">
                  {localHiddenItemIds.map((hiddenId) => {
                    const orig = currentTemplate.items.find((it) => it.id === hiddenId);
                    if (!orig) return null;
                    return (
                      <button
                        type="button"
                        key={hiddenId}
                        onClick={() => unhideTemplateItem(hiddenId)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#6b7280] bg-[#f4f6f8] hover:bg-[#e2e8f0] rounded-[6px] px-2 py-0.5 cursor-pointer"
                        title="다시 보이기"
                      >
                        <RotateCcw size={11} /> {orig.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 항목 추가 */}
            <div className="pt-2 mt-2 border-t border-[#f1f5f9] flex items-center gap-2">
              <input
                type="text"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomItem();
                  }
                }}
                placeholder="이 수업에만 추가할 항목"
                className="flex-1 text-[12px] border border-[#e2e8f0] rounded-[6px] px-2 py-1 focus:outline-none focus:border-[#4fc3a1]"
              />
              <button
                type="button"
                onClick={addCustomItem}
                className="inline-flex items-center gap-1 text-[11.5px] text-[#4fc3a1] hover:text-[#3aaa8c] cursor-pointer"
                title="이 수업에만 추가"
              >
                <Plus size={13} /> 추가
              </button>
            </div>

            {currentTemplate.items.length === 0 && localCustomItems.length === 0 && (
              <div className="text-[12px] text-[#9ca3af] py-1 px-1.5">
                양식에 항목이 없습니다. 위 입력란으로 이 수업에만 쓸 항목을 추가하세요.
              </div>
            )}
          </div>
        )}

        {savedResult && (
          <div className="mt-1.5 text-[11px] text-[#9ca3af] flex flex-wrap gap-x-3 gap-y-0.5">
            <span>작성 {savedResult.authorName ?? '미상'}</span>
            <span>
              {savedResult.checkedById
                ? `체크 ${savedResult.checkedByName ?? '미상'}${savedResult.checkedAt ? ` · ${new Date(savedResult.checkedAt).toLocaleDateString('ko-KR')}` : ''}`
                : '체크 전'}
            </span>
          </div>
        )}
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end pt-1">
        <Button
          variant="dark"
          size="sm"
          onClick={handleSave}
          disabled={saving || !selectedStudentId}
        >
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}
