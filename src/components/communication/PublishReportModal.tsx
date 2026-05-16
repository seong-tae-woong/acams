'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import { X } from 'lucide-react';
import TokenPanel, { insertTokenAtCursor } from '@/components/reports/TokenPanel';
import { ChartPresetRenderer, CHART_PRESETS, type ChartPresetKey } from '@/components/reports/charts';

interface LayoutBlock { type: 'chart'; preset: ChartPresetKey; title?: string }
interface PeriodicPreview {
  renderedBody: string;
  layout: LayoutBlock[];
  studentName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: { charts: Record<string, any>; averageScore: number | null; examCount: number; period: { label: string; startLabel: string; endLabel: string } };
}

interface ExamLite {
  id: string;
  name: string;
  classId: string;
  totalScore: number;
  date: string;
}

interface ClassInfo {
  id: string;
  name: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
  alias: string;
  bodyMarkdown: string;
  passThreshold: number;
  kind: 'PER_EXAM' | 'PERIODIC';
  periodMonths: number | null;
  layout?: unknown;
}

interface Props {
  open: boolean;
  onClose: () => void;
  // 진입점:
  //  - 'exam': 시험 목록에서 진입 (시험 컨텍스트 고정, PER_EXAM 전용, kind 토글 없음)
  //  - 'tab' : 리포트 발행 탭에서 진입 (kind 토글, PER_EXAM 시 반·시험 드롭다운)
  source: 'exam' | 'tab';
  // source='exam' 전용 (필수)
  exam?: ExamLite;
  examClassName?: string;
  examClassStudents?: { id: string; name: string }[];
  // 공통: 학원 전체 반·학생·시험 목록 (source='tab' 또는 PERIODIC 발행에 사용)
  allClasses?: ClassInfo[];
  studentsByClass?: Record<string, { id: string; name: string }[]>;
  allExams?: ExamLite[];
  onPublished?: () => void;
}

type Mode = 'class' | 'student';
type Kind = 'PER_EXAM' | 'PERIODIC';

export default function PublishReportModal({
  open, onClose, source,
  exam: examProp, examClassName, examClassStudents,
  allClasses, studentsByClass, allExams,
  onPublished,
}: Props) {
  const [kind, setKind] = useState<Kind>('PER_EXAM');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [mode, setMode] = useState<Mode>('class');
  // 'tab' 모드 PER_EXAM 시 반·시험을 사용자가 선택
  const [tabClassId, setTabClassId] = useState<string>('');
  const [tabExamId, setTabExamId] = useState<string>('');

  // 활성 시험·반 컨텍스트 (source에 따라 다름)
  const activeExam: ExamLite | undefined = source === 'exam'
    ? examProp
    : (allExams ?? []).find((e) => e.id === tabExamId);
  const activeClassId = activeExam?.classId ?? '';
  const activeClassName = source === 'exam'
    ? (examClassName ?? '')
    : ((allClasses ?? []).find((c) => c.id === activeClassId)?.name ?? '');
  const activeClassStudents: { id: string; name: string }[] = source === 'exam'
    ? (examClassStudents ?? [])
    : ((studentsByClass ?? {})[activeClassId] ?? []);

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [passThreshold, setPassThreshold] = useState(70);
  const [summary, setSummary] = useState('');
  const [editedBody, setEditedBody] = useState<string>('');           // 본문 (수정 가능)
  const [bodyDirty, setBodyDirty] = useState(false);                  // 양식 본문에서 변경됐는지
  const [editedTitle, setEditedTitle] = useState<string>('');         // 제목 (수정 가능, 기본 = 양식 이름)
  const [titleDirty, setTitleDirty] = useState(false);
  const [editedLayout, setEditedLayout] = useState<LayoutBlock[]>([]); // 차트 블록 (PERIODIC, 수정 가능)
  const [layoutDirty, setLayoutDirty] = useState(false);              // 양식 차트 블록에서 변경됐는지
  const [preview, setPreview] = useState<{ renderedBody: string; raw: Record<string, unknown> } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // PERIODIC 미리보기
  const [periodicPreview, setPeriodicPreview] = useState<PeriodicPreview | null>(null);
  const [periodicPreviewLoading, setPeriodicPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertToken = (token: string) => insertTokenAtCursor(bodyRef, editedBody, (v) => { setEditedBody(v); setBodyDirty(true); }, token);

  // kind에 맞는 템플릿 목록
  useEffect(() => {
    if (!open) return;
    fetch(`/api/communication/report-templates?kind=${kind}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data);
          // kind 변경 시 첫 번째 양식 자동 선택
          if (data.length > 0) {
            setTemplateId(data[0].id);
            setPassThreshold(data[0].passThreshold ?? 70);
            setBodyDirty(false);
            setEditedBody(data[0].bodyMarkdown ?? '');
            setTitleDirty(false);
            setEditedTitle(data[0].name ?? '');
            setLayoutDirty(false);
            setEditedLayout(Array.isArray(data[0].layout) ? (data[0].layout as LayoutBlock[]) : []);
          } else {
            setTemplateId('');
            setEditedBody('');
            setEditedTitle('');
            setEditedLayout([]);
          }
        }
      });
  }, [open, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // kind 변경 시 대상 초기화
  useEffect(() => {
    if (kind === 'PER_EXAM' && activeClassId) {
      setSelectedClassIds([activeClassId]);
    } else {
      setSelectedClassIds([]);
    }
    setSelectedStudentIds([]);
    setMode('class');
  }, [kind, activeClassId]);

  // source='tab' & PER_EXAM: 반 변경 시 시험 자동 첫 번째로
  const tabClassExams = source === 'tab' && tabClassId
    ? (allExams ?? []).filter((e) => e.classId === tabClassId)
    : [];
  useEffect(() => {
    if (source !== 'tab' || kind !== 'PER_EXAM') return;
    if (tabClassId && !tabClassExams.find((e) => e.id === tabExamId)) {
      setTabExamId(tabClassExams[0]?.id ?? '');
    }
  }, [source, kind, tabClassId, tabClassExams.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 템플릿 변경 시 임계값/본문/제목/차트 자동 설정 (dirty 아닐 때만)
  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setPassThreshold(t.passThreshold ?? 70);
      if (!bodyDirty) setEditedBody(t.bodyMarkdown ?? '');
      if (!titleDirty) setEditedTitle(t.name ?? '');
      if (!layoutDirty) setEditedLayout(Array.isArray(t.layout) ? (t.layout as LayoutBlock[]) : []);
    }
  }, [templateId, templates]); // eslint-disable-line react-hooks/exhaustive-deps

  // 양식 원래 본문 복원
  const resetBody = () => {
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setEditedBody(t.bodyMarkdown ?? '');
      setBodyDirty(false);
    }
  };
  // 양식 원래 제목 복원
  const resetTitle = () => {
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setEditedTitle(t.name ?? '');
      setTitleDirty(false);
    }
  };
  // 양식 원래 차트 블록 복원
  const resetLayout = () => {
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setEditedLayout(Array.isArray(t.layout) ? (t.layout as LayoutBlock[]) : []);
      setLayoutDirty(false);
    }
  };

  // 미리보기는 PER_EXAM에서만 의미 있음 (실시간 점수 치환)
  const firstTargetId = useMemo(() => {
    if (kind !== 'PER_EXAM') return undefined;
    if (!activeExam) return undefined;
    if (mode === 'student') return selectedStudentIds[0];
    if (selectedClassIds.includes(activeClassId)) return activeClassStudents[0]?.id;
    return undefined;
  }, [kind, mode, selectedStudentIds, selectedClassIds, activeClassId, activeClassStudents, activeExam]);

  // PERIODIC 미리보기: 첫 대상 학생 결정 (mode=class면 첫 반의 첫 학생, mode=student면 첫 학생)
  const periodicFirstTargetId = useMemo(() => {
    if (kind !== 'PERIODIC') return undefined;
    if (mode === 'student') return selectedStudentIds[0];
    if (!studentsByClass) return undefined;
    for (const cid of selectedClassIds) {
      const list = studentsByClass[cid];
      if (list && list.length > 0) return list[0].id;
    }
    return undefined;
  }, [kind, mode, selectedStudentIds, selectedClassIds, studentsByClass]);

  useEffect(() => {
    if (!open || kind !== 'PERIODIC' || !templateId || !periodicFirstTargetId) {
      setPeriodicPreview(null);
      return;
    }
    setPeriodicPreviewLoading(true);
    const handle = setTimeout(() => {
      fetch('/api/reports/preview-periodic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, studentId: periodicFirstTargetId, bodyMarkdown: editedBody }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setPeriodicPreview(null);
          else setPeriodicPreview(data);
        })
        .finally(() => setPeriodicPreviewLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [open, kind, templateId, periodicFirstTargetId, editedBody]);

  useEffect(() => {
    if (!open || !firstTargetId || !editedBody || !activeExam) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const handle = setTimeout(() => {
      fetch('/api/reports/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: activeExam.id, studentId: firstTargetId, passThreshold, bodyMarkdown: editedBody }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setPreview(null);
          else setPreview(data);
        })
        .finally(() => setPreviewLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [open, editedBody, firstTargetId, passThreshold, activeExam]);

  // 통합 발행 모달의 대상 인원 계산
  const targetCount = (() => {
    if (mode === 'student') return selectedStudentIds.length;
    if (kind === 'PER_EXAM') {
      if (!activeClassId) return 0;
      return selectedClassIds.includes(activeClassId) ? activeClassStudents.length : 0;
    }
    if (!studentsByClass) return 0;
    return selectedClassIds.reduce((sum, cid) => sum + (studentsByClass[cid]?.length ?? 0), 0);
  })();

  const periodicClasses = allClasses ?? [];
  const periodicStudentsByClass = studentsByClass ?? {};

  const toggleClassMulti = (id: string) => {
    setSelectedClassIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!templateId) {
      toast('양식을 선택하세요.', 'error');
      return;
    }
    if (targetCount === 0) {
      toast('대상 학생이 없습니다.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (kind === 'PER_EXAM' && !activeExam) {
        toast('시험을 선택하세요.', 'error');
        return;
      }
      const url = kind === 'PER_EXAM' ? '/api/reports/publish' : '/api/reports/publish-periodic';
      const payload = kind === 'PER_EXAM'
        ? {
            templateId,
            examId: activeExam!.id,
            classIds: mode === 'class' ? selectedClassIds : undefined,
            studentIds: mode === 'student' ? selectedStudentIds : undefined,
            passThreshold,
            summary,
            overrideBody: bodyDirty ? editedBody : undefined,
            overrideTitle: titleDirty ? editedTitle : undefined,
          }
        : {
            templateId,
            classIds: mode === 'class' ? selectedClassIds : undefined,
            studentIds: mode === 'student' ? selectedStudentIds : undefined,
            summary,
            overrideBody: bodyDirty ? editedBody : undefined,
            overrideTitle: titleDirty ? editedTitle : undefined,
            overrideLayout: layoutDirty ? editedLayout : undefined,
          };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || '발행 실패', 'error');
        return;
      }
      toast(`${data.count}명에게 리포트 발송 완료`, 'success');
      onClose();
      // 부모가 이력 새로고침할 시간 확보 (close가 먼저 처리되도록)
      await Promise.resolve();
      onPublished?.();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={source === 'exam' && examProp ? `${examProp.name} 리포트 발행` : '리포트 발행'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="default" size="md" onClick={onClose}>취소</Button>
          <Button variant="dark" size="md" onClick={handleSubmit} disabled={submitting || targetCount === 0}>
            {submitting ? '발행 중…' : `${targetCount}명에게 발행`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 종류 토글 — 'tab' 진입에서만 표시 */}
        {source === 'tab' && (
          <div>
            <label className="text-[11.5px] font-medium text-[#374151] block mb-1.5">리포트 종류</label>
            <div className="flex gap-2">
              {(['PER_EXAM', 'PERIODIC'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={clsx(
                    'px-3 py-1.5 rounded-[6px] text-[11.5px] font-medium cursor-pointer',
                    kind === k ? 'bg-[#1a2535] text-white' : 'bg-[#f1f5f9] text-[#6b7280]',
                  )}
                >
                  {k === 'PER_EXAM' ? '시험별 리포트' : '주기별 리포트'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 'tab' & PER_EXAM: 반·시험 선택 드롭다운 */}
        {source === 'tab' && kind === 'PER_EXAM' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] font-medium text-[#374151] block mb-1">반 선택</label>
              <select
                value={tabClassId}
                onChange={(e) => setTabClassId(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
              >
                <option value="">반을 선택하세요</option>
                {(allClasses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11.5px] font-medium text-[#374151] block mb-1">시험 선택</label>
              <select
                value={tabExamId}
                onChange={(e) => setTabExamId(e.target.value)}
                disabled={!tabClassId}
                className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px] disabled:bg-[#f9fafb]"
              >
                <option value="">{tabClassId ? '시험을 선택하세요' : '먼저 반 선택'}</option>
                {tabClassExams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({new Date(e.date).toISOString().slice(0, 10)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 양식 선택 */}
        <div>
          <label className="text-[11.5px] font-medium text-[#374151] block mb-1">양식</label>
          {templates.length === 0 ? (
            <div className="text-[12px] text-[#ef4444]">
              발행 가능한 {kind === 'PER_EXAM' ? '시험별' : '주기별'} 양식이 없습니다.
              {' '}<a href="/students/grades" className="underline">양식 관리에서 만들기</a>
            </div>
          ) : (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
            >
              {templates.map((t) => {
                const aliasPart = t.alias ? ` — ${t.alias}` : '';
                const periodPart = kind === 'PERIODIC' && t.periodMonths ? ` (최근 ${t.periodMonths}개월)` : '';
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}{aliasPart}{periodPart}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* 대상 선택 */}
        <div>
          <label className="text-[11.5px] font-medium text-[#374151] block mb-1.5">대상</label>
          <div className="flex gap-2 mb-2">
            {(['class', 'student'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  'px-3 py-1.5 rounded-[6px] text-[11.5px] font-medium cursor-pointer',
                  mode === m ? 'bg-[#1a2535] text-white' : 'bg-[#f1f5f9] text-[#6b7280]',
                )}
              >
                {m === 'class'
                  ? (kind === 'PER_EXAM' ? `반 전체${activeClassName ? ` (${activeClassName})` : ''}` : '반 단위')
                  : '개별 학생 선택'}
              </button>
            ))}
          </div>

          {/* PER_EXAM 학생 선택 — 시험 반의 학생만 */}
          {kind === 'PER_EXAM' && mode === 'student' && (
            <div className="border border-[#e2e8f0] rounded-[8px] max-h-44 overflow-y-auto p-2">
              {activeClassStudents.length === 0 ? (
                <div className="text-[12px] text-[#9ca3af] p-2">{activeClassId ? '반에 활성 학생이 없습니다.' : '먼저 반·시험을 선택하세요.'}</div>
              ) : (
                activeClassStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-[#f4f6f8] rounded px-1.5">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                    />
                    <span className="text-[12.5px] text-[#111827]">{s.name}</span>
                  </label>
                ))
              )}
              {activeClassStudents.length > 0 && (
                <div className="border-t border-[#f1f5f9] mt-2 pt-2 flex gap-3">
                  <button
                    onClick={() => setSelectedStudentIds(activeClassStudents.map((s) => s.id))}
                    className="text-[11px] text-[#4fc3a1] cursor-pointer hover:underline"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={() => setSelectedStudentIds([])}
                    className="text-[11px] text-[#6b7280] cursor-pointer hover:underline"
                  >
                    선택 해제
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PERIODIC 반 멀티선택 */}
          {kind === 'PERIODIC' && mode === 'class' && (
            <div className="border border-[#e2e8f0] rounded-[8px] max-h-44 overflow-y-auto p-2">
              {periodicClasses.length === 0 ? (
                <div className="text-[12px] text-[#9ca3af] p-2">반 정보 없음</div>
              ) : (
                periodicClasses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-[#f4f6f8] rounded px-1.5">
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(c.id)}
                      onChange={() => toggleClassMulti(c.id)}
                    />
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-[12.5px] text-[#111827] flex-1">{c.name}</span>
                    <span className="text-[10.5px] text-[#9ca3af]">{periodicStudentsByClass[c.id]?.length ?? 0}명</span>
                  </label>
                ))
              )}
            </div>
          )}

          {/* PERIODIC 학생 멀티선택 (반별 그룹) */}
          {kind === 'PERIODIC' && mode === 'student' && (
            <div className="border border-[#e2e8f0] rounded-[8px] max-h-44 overflow-y-auto p-2 space-y-2">
              {periodicClasses.map((c) => {
                const list = periodicStudentsByClass[c.id] ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={c.id}>
                    <div className="text-[10.5px] font-semibold text-[#6b7280] mt-1 mb-1">{c.name}</div>
                    {list.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-0.5 pl-2 cursor-pointer hover:bg-[#f4f6f8] rounded">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
                        />
                        <span className="text-[12.5px] text-[#111827]">{s.name}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
              {periodicClasses.length === 0 && (
                <div className="text-[12px] text-[#9ca3af] p-2">반 정보 없음</div>
              )}
            </div>
          )}
        </div>

        {/* 합격 임계값 (PER_EXAM만) + 요약 */}
        <div className="grid grid-cols-2 gap-3">
          {kind === 'PER_EXAM' && (
            <div>
              <label className="text-[11.5px] font-medium text-[#374151] block mb-1">합격 임계값 (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={passThreshold}
                onChange={(e) => setPassThreshold(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
              />
            </div>
          )}
          <div className={kind === 'PER_EXAM' ? '' : 'col-span-2'}>
            <label className="text-[11.5px] font-medium text-[#374151] block mb-1">요약 (선택)</label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={kind === 'PER_EXAM' ? '비워두면 점수·순위로 자동 생성' : '비워두면 평균/시험수로 자동 생성'}
              className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
            />
          </div>
        </div>

        {/* 제목 편집 (양식 이름이 기본값, 이번 발행만 한정 수정) */}
        {templateId && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11.5px] font-medium text-[#374151]">
                제목 {titleDirty && <span className="text-[#0D9E7A] font-semibold ml-1">· 수정됨</span>}
              </label>
              {titleDirty && (
                <button
                  type="button"
                  onClick={resetTitle}
                  className="text-[10.5px] text-[#6b7280] hover:underline cursor-pointer"
                >
                  양식 이름으로 되돌리기
                </button>
              )}
            </div>
            <input
              value={editedTitle}
              onChange={(e) => { setEditedTitle(e.target.value); setTitleDirty(true); }}
              placeholder="양식 이름이 기본값"
              className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
            />
            <div className="text-[10.5px] text-[#9ca3af] mt-1">
              학부모/학생 PWA 리포트 리스트에 노출되는 제목입니다. 양식 이름은 변경되지 않고, 이번 발행에만 적용됩니다.
            </div>
          </div>
        )}

        {/* 본문 편집 (시험별·주기별 모두 — 이번 발행만 한정 수정) */}
        {templateId && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11.5px] font-medium text-[#374151]">
                본문 {bodyDirty && <span className="text-[#0D9E7A] font-semibold ml-1">· 수정됨</span>}
              </label>
              {bodyDirty && (
                <button
                  type="button"
                  onClick={resetBody}
                  className="text-[10.5px] text-[#6b7280] hover:underline cursor-pointer"
                >
                  양식 원본으로 되돌리기
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1fr_180px] gap-2">
              <textarea
                ref={bodyRef}
                value={editedBody}
                onChange={(e) => { setEditedBody(e.target.value); setBodyDirty(true); }}
                rows={6}
                placeholder="양식을 선택하면 본문이 자동으로 채워집니다. 이번 발행만 한정으로 수정할 수 있습니다."
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-[8px] text-[12.5px] font-mono leading-relaxed"
              />
              <TokenPanel onInsert={insertToken} variant="inline" kind={kind} />
            </div>
            <div className="text-[10.5px] text-[#9ca3af] mt-1">
              우측 토큰을 클릭하면 커서 위치에 삽입됩니다. 양식은 변경되지 않고, 이번 발행에만 적용됩니다.
            </div>
          </div>
        )}

        {/* 차트 블록 편집 (PERIODIC — 양식 차트 로딩 + 이번 발행만 한정 수정) */}
        {kind === 'PERIODIC' && templateId && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11.5px] font-medium text-[#374151]">
                차트 블록 ({editedLayout.length}개)
                {layoutDirty && <span className="text-[#0D9E7A] font-semibold ml-1">· 수정됨</span>}
              </label>
              {layoutDirty && (
                <button
                  type="button"
                  onClick={resetLayout}
                  className="text-[10.5px] text-[#6b7280] hover:underline cursor-pointer"
                >
                  양식 차트로 되돌리기
                </button>
              )}
            </div>
            <div className="space-y-2 mb-2">
              {editedLayout.length === 0 && (
                <div className="text-[12px] text-[#9ca3af] py-3 text-center border border-dashed border-[#e2e8f0] rounded-[8px]">
                  아래에서 차트를 추가하세요
                </div>
              )}
              {editedLayout.map((block, i) => {
                const meta = CHART_PRESETS.find((p) => p.key === block.preset);
                return (
                  <div key={i} className="flex items-center gap-2 p-2 bg-[#f9fafb] border border-[#e2e8f0] rounded-[8px]">
                    <span className="text-[11.5px] text-[#9ca3af] w-5">{i + 1}.</span>
                    <input
                      value={block.title ?? ''}
                      onChange={(e) => {
                        const next = [...editedLayout];
                        next[i] = { ...block, title: e.target.value };
                        setEditedLayout(next);
                        setLayoutDirty(true);
                      }}
                      placeholder={meta?.label ?? block.preset}
                      className="flex-1 px-2 py-1 text-[12px] border border-[#e2e8f0] rounded-[6px] bg-white"
                    />
                    <span className="text-[10.5px] text-[#6b7280] bg-white px-1.5 py-0.5 rounded border border-[#e2e8f0]">
                      {meta?.label ?? block.preset}
                    </span>
                    <button
                      onClick={() => { setEditedLayout(editedLayout.filter((_, k) => k !== i)); setLayoutDirty(true); }}
                      className="text-[#9ca3af] hover:text-[#ef4444] cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div>
              <div className="text-[10.5px] font-semibold text-[#6b7280] uppercase mb-1.5">차트 추가</div>
              <div className="flex flex-wrap gap-1.5">
                {CHART_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => { setEditedLayout([...editedLayout, { type: 'chart', preset: p.key }]); setLayoutDirty(true); }}
                    title={p.description}
                    className="px-2.5 py-1 bg-white border border-[#e2e8f0] rounded-[6px] text-[11.5px] text-[#374151] hover:border-[#4fc3a1] hover:text-[#0D9E7A] cursor-pointer"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[10.5px] text-[#9ca3af] mt-1">
              양식에서 선정한 차트가 로딩됩니다. 차트를 추가·삭제·이름 변경하면 양식은 변경되지 않고 이번 발행에만 적용됩니다.
            </div>
          </div>
        )}

        {/* 미리보기 (PER_EXAM만) */}
        {kind === 'PER_EXAM' && (
          <div>
            <label className="text-[11.5px] font-medium text-[#374151] block mb-1">
              미리보기 {firstTargetId ? '(첫 번째 대상 학생 기준)' : ''}
            </label>
            <div className="bg-[#f9fafb] border border-[#e2e8f0] rounded-[8px] p-3 min-h-[80px] text-[12.5px] whitespace-pre-wrap leading-relaxed">
              {previewLoading && <span className="text-[#9ca3af]">불러오는 중…</span>}
              {!previewLoading && preview && preview.renderedBody}
              {!previewLoading && !preview && (
                <span className="text-[#9ca3af]">대상 학생을 선택하면 미리보기가 표시됩니다.</span>
              )}
            </div>
          </div>
        )}

        {kind === 'PERIODIC' && (
          <>
            <div className="text-[11.5px] text-[#9ca3af]">
              발행 시점 기준으로 양식의 집계 개월 수에 맞춰 자동 산정됩니다.
              본문·임계값 등은 양식에서 미리 설정된 값을 그대로 사용합니다.
            </div>

            <div>
              <label className="text-[11.5px] font-medium text-[#374151] block mb-1">
                미리보기 {periodicFirstTargetId ? `(${periodicPreview?.studentName ?? '대상'} 기준)` : ''}
              </label>
              <div className="bg-[#f9fafb] border border-[#e2e8f0] rounded-[8px] p-3 space-y-3">
                {periodicPreviewLoading && <div className="text-[12px] text-[#9ca3af]">불러오는 중…</div>}
                {!periodicPreviewLoading && !periodicPreview && (
                  <div className="text-[12px] text-[#9ca3af]">대상을 선택하면 미리보기가 표시됩니다.</div>
                )}
                {periodicPreview && (
                  <>
                    {/* 본문 */}
                    <div className="text-[12.5px] text-[#111827] whitespace-pre-wrap leading-relaxed bg-white border border-[#e2e8f0] rounded-[6px] p-2.5">
                      {periodicPreview.renderedBody || <span className="text-[#9ca3af]">본문 없음</span>}
                    </div>

                    {/* 차트 블록 (발행 화면에서 선정·수정한 차트 기준) */}
                    {editedLayout.length > 0 && (
                      <div className="space-y-2">
                        {editedLayout
                          .filter((b) => b?.type === 'chart')
                          .map((block, i) => {
                            const chartData = periodicPreview.data?.charts?.[block.preset];
                            return (
                              <div key={i} className="bg-white border border-[#e2e8f0] rounded-[6px] p-2.5">
                                <div className="text-[11.5px] font-semibold text-[#111827] mb-1">
                                  {block.title ?? block.preset}
                                </div>
                                <ChartPresetRenderer preset={block.preset} data={chartData} />
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* 데이터 요약 */}
                    <div className="flex gap-3 text-[11px] text-[#6b7280]">
                      <span>평균 <b className="text-[#111827]">{periodicPreview.data?.averageScore ?? '-'}</b>점</span>
                      <span>응시 <b className="text-[#111827]">{periodicPreview.data?.examCount ?? 0}</b>회</span>
                      <span>{periodicPreview.data?.period?.startLabel} ~ {periodicPreview.data?.period?.endLabel}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
