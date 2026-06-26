'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import { X } from 'lucide-react';
import TokenPanel, { insertTokenAtCursor } from '@/components/reports/TokenPanel';
import { ChartPresetRenderer, CHART_PRESETS, type ChartPresetKey } from '@/components/reports/charts';
import CategoryScopeTree, { type CategoryScope, EMPTY_SCOPE, scopeCount } from '@/components/reports/CategoryScopeTree';
import { useGradeStore } from '@/lib/stores/gradeStore';

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
  scopeFilter?: { category1Ids?: string[]; category2Ids?: string[]; category3Ids?: string[] };
}

// 양식 없이 발행 화면에서 직접 작성하는 모드 (templateId 자리에 넣는 sentinel)
const DIRECT = '__direct__';

interface Props {
  open: boolean;
  onClose: () => void;
  // 진입점:
  //  - 'exam': 시험 목록에서 진입 (시험 컨텍스트 고정, PER_EXAM 전용, kind 토글 없음)
  //  - 'tab' : 리포트 발행 탭에서 진입 (kind 토글, PER_EXAM 시 반·시험 드롭다운)
  source: 'exam' | 'tab' | 'session';
  // source='exam' 전용 (필수)
  exam?: ExamLite;
  examClassName?: string;
  examClassStudents?: { id: string; name: string }[];
  // source='session' 전용 (DAILY — 반·날짜 고정, 학생만 선택)
  sessionClassId?: string;
  sessionClassName?: string;
  sessionDate?: string; // YYYY-MM-DD
  sessionClassStudents?: { id: string; name: string }[];
  // 공통: 학원 전체 반·학생·시험 목록 (source='tab' 또는 PERIODIC 발행에 사용)
  allClasses?: ClassInfo[];
  studentsByClass?: Record<string, { id: string; name: string }[]>;
  allExams?: ExamLite[];
  onPublished?: () => void;
}

type Mode = 'class' | 'student';
type Kind = 'PER_EXAM' | 'PERIODIC' | 'DAILY';

export default function PublishReportModal({
  open, onClose, source,
  exam: examProp, examClassName, examClassStudents,
  sessionClassId, sessionClassName, sessionDate, sessionClassStudents,
  allClasses, studentsByClass, allExams,
  onPublished,
}: Props) {
  // 시험별(PER_EXAM)은 숨김 — exam 진입(고정 컨텍스트)에서만 사용. tab/session 기본은 수업(DAILY)
  const [kind, setKind] = useState<Kind>(source === 'exam' ? 'PER_EXAM' : 'DAILY');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [mode, setMode] = useState<Mode>('class');
  // 'tab' 모드 PER_EXAM 시 반·시험을 사용자가 선택
  const [tabClassId, setTabClassId] = useState<string>('');
  const [tabExamId, setTabExamId] = useState<string>('');
  const [tabDate, setTabDate] = useState<string>(''); // DAILY tab: 날짜 선택

  // 활성 시험·반 컨텍스트 (source에 따라 다름)
  const activeExam: ExamLite | undefined = source === 'exam'
    ? examProp
    : (allExams ?? []).find((e) => e.id === tabExamId);

  // DAILY: 반·날짜는 session(고정) 또는 tab(선택)에서
  const dailyClassId = source === 'session' ? (sessionClassId ?? '') : tabClassId;
  const activeDate = source === 'session' ? (sessionDate ?? '') : tabDate;

  // 단일 반 로스터 기반 종류(PER_EXAM·DAILY)의 활성 반/학생
  const activeClassId = kind === 'DAILY' ? dailyClassId : (activeExam?.classId ?? '');
  const activeClassName = kind === 'DAILY'
    ? (source === 'session' ? (sessionClassName ?? '') : ((allClasses ?? []).find((c) => c.id === dailyClassId)?.name ?? ''))
    : source === 'exam'
      ? (examClassName ?? '')
      : ((allClasses ?? []).find((c) => c.id === activeClassId)?.name ?? '');
  const activeClassStudents: { id: string; name: string }[] = kind === 'DAILY'
    ? (source === 'session' ? (sessionClassStudents ?? []) : ((studentsByClass ?? {})[dailyClassId] ?? []))
    : source === 'exam'
      ? (examClassStudents ?? [])
      : ((studentsByClass ?? {})[activeClassId] ?? []);

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  // DAILY 다중 시험: 그날 시험 중 리포트에 포함할 시험 (기본 전체 체크). session 진입은 allExams가 없어 직접 fetch
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [fetchedDayExams, setFetchedDayExams] = useState<ExamLite[]>([]);
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
  // DAILY 미리보기
  const [dailyPreview, setDailyPreview] = useState<{ renderedBody: string } | null>(null);
  const [dailyPreviewLoading, setDailyPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // 직접 작성(양식 없음) 모드 — 집계 기간·임계값·대상 카테고리를 직접 지정
  const [directPeriodMonths, setDirectPeriodMonths] = useState(3);
  const [directPassThreshold, setDirectPassThreshold] = useState(70);
  const [directScope, setDirectScope] = useState<CategoryScope>(EMPTY_SCOPE);
  const { categories, fetchCategories } = useGradeStore();
  useEffect(() => { fetchCategories(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirect = templateId === DIRECT;
  const hasTemplate = !!templateId && !isDirect;
  // 양식을 가져온 경우 카테고리는 양식 값 — 발행 화면에서 읽기전용
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const templateScope: CategoryScope = {
    category1Ids: selectedTemplate?.scopeFilter?.category1Ids ?? [],
    category2Ids: selectedTemplate?.scopeFilter?.category2Ids ?? [],
    category3Ids: selectedTemplate?.scopeFilter?.category3Ids ?? [],
  };

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
            // 양식이 하나도 없을 때: 기간은 '직접 작성'으로, 시험별은 빈 값으로
            setTemplateId(kind === 'PERIODIC' ? DIRECT : '');
            setEditedBody('');
            setEditedTitle('');
            setEditedLayout([]);
          }
        }
      });
  }, [open, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // kind 변경 시 대상 초기화
  useEffect(() => {
    if ((kind === 'PER_EXAM' || kind === 'DAILY') && activeClassId) {
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

  // 직접 작성 모드 진입 시 입력값 초기화 (본문/제목/차트/집계설정 비우기)
  useEffect(() => {
    if (templateId !== DIRECT) return;
    setEditedBody(''); setBodyDirty(false);
    setEditedTitle(''); setTitleDirty(false);
    setEditedLayout([]); setLayoutDirty(false);
    setDirectPeriodMonths(3);
    setDirectPassThreshold(70);
    setDirectScope(EMPTY_SCOPE);
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // DAILY 미리보기: 첫 대상의 (반, 학생) 결정 — 다중 반이라 학생이 속한 반까지 알아야 함
  const dailyTarget = useMemo<{ classId: string; studentId: string } | null>(() => {
    if (kind !== 'DAILY' || !activeDate) return null;
    if (source === 'session') {
      if (!activeClassId) return null;
      const sid = mode === 'student'
        ? selectedStudentIds[0]
        : (selectedClassIds.includes(activeClassId) ? activeClassStudents[0]?.id : undefined);
      return sid ? { classId: activeClassId, studentId: sid } : null;
    }
    // tab DAILY (다중 반)
    if (mode === 'student') {
      const sid = selectedStudentIds[0];
      if (!sid || !studentsByClass) return null;
      const cid = Object.keys(studentsByClass).find((k) => (studentsByClass[k] ?? []).some((s) => s.id === sid));
      return cid ? { classId: cid, studentId: sid } : null;
    }
    if (!studentsByClass) return null;
    for (const cid of selectedClassIds) {
      const list = studentsByClass[cid];
      if (list && list.length > 0) return { classId: cid, studentId: list[0].id };
    }
    return null;
  }, [kind, source, mode, selectedStudentIds, selectedClassIds, activeClassId, activeDate, activeClassStudents, studentsByClass]);

  // DAILY 그날 시험 목록 — tab은 allExams에서 필터, session은 직접 fetch한 것에서
  const dailyExamClassIds = useMemo(
    () => (source === 'session' ? (sessionClassId ? [sessionClassId] : []) : selectedClassIds),
    [source, sessionClassId, selectedClassIds],
  );
  const dayExams = useMemo<ExamLite[]>(() => {
    if (kind !== 'DAILY' || !activeDate || dailyExamClassIds.length === 0) return [];
    const pool = (allExams && allExams.length) ? allExams : fetchedDayExams;
    return pool.filter((e) => dailyExamClassIds.includes(e.classId) && e.date.slice(0, 10) === activeDate);
  }, [kind, activeDate, dailyExamClassIds, allExams, fetchedDayExams]);

  // session 진입은 allExams가 없으므로 그날 그 반 시험을 직접 조회
  useEffect(() => {
    if (!open || kind !== 'DAILY' || source !== 'session') return;
    if (allExams && allExams.length) return; // tab은 prop 사용
    if (!sessionClassId || !activeDate) return;
    fetch(`/api/exams?classId=${sessionClassId}&from=${activeDate}&to=${activeDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFetchedDayExams(
            data.map((e) => ({ id: e.id, name: e.name, classId: e.classId, totalScore: e.totalScore, date: e.date })),
          );
        }
      })
      .catch(() => {});
  }, [open, kind, source, sessionClassId, activeDate, allExams]);

  // 그날 시험 집합이 바뀌면 전체 선택으로 리셋 (기본 전체 포함)
  const dayExamsKey = dayExams.map((e) => e.id).join(',');
  useEffect(() => {
    setSelectedExamIds(dayExams.map((e) => e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayExamsKey]);

  // 시험 체크리스트 표시용 반별 그룹
  const examGroups = useMemo(() => {
    const byClass = new Map<string, { classId: string; className: string; exams: ExamLite[] }>();
    for (const e of dayExams) {
      const className = source === 'session'
        ? (sessionClassName ?? '')
        : ((allClasses ?? []).find((c) => c.id === e.classId)?.name ?? '');
      if (!byClass.has(e.classId)) byClass.set(e.classId, { classId: e.classId, className, exams: [] });
      byClass.get(e.classId)!.exams.push(e);
    }
    return [...byClass.values()];
  }, [dayExams, allClasses, source, sessionClassName]);

  const toggleExam = (id: string) =>
    setSelectedExamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
      const previewBody = isDirect
        ? {
            studentId: periodicFirstTargetId, bodyMarkdown: editedBody,
            periodMonths: directPeriodMonths, passThreshold: directPassThreshold, scopeFilter: directScope,
          }
        : { templateId, studentId: periodicFirstTargetId, bodyMarkdown: editedBody };
      fetch('/api/reports/preview-periodic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewBody),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setPeriodicPreview(null);
          else setPeriodicPreview(data);
        })
        .finally(() => setPeriodicPreviewLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [open, kind, templateId, periodicFirstTargetId, editedBody, isDirect, directPeriodMonths, directPassThreshold, directScope]);

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

  // DAILY 미리보기 fetch — 선택된 시험(examIds)을 반영
  // deps는 원시값으로 (dailyTarget은 매 렌더 새 객체라 그대로 넣으면 effect가 무한 재실행됨)
  const examIdsForApi = dayExams.length > 0 ? selectedExamIds : undefined;
  const previewClassId = dailyTarget?.classId;
  const previewStudentId = dailyTarget?.studentId;
  const examIdsKey = (examIdsForApi ?? ['__all__']).join(',');
  useEffect(() => {
    if (!open || kind !== 'DAILY' || !previewClassId || !previewStudentId || !editedBody || !activeDate) {
      setDailyPreview(null);
      return;
    }
    setDailyPreviewLoading(true);
    const handle = setTimeout(() => {
      fetch('/api/reports/preview-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: previewClassId, date: activeDate, studentId: previewStudentId,
          passThreshold, bodyMarkdown: editedBody, examIds: examIdsForApi,
        }),
      })
        .then((r) => r.json())
        .then((data) => { if (data.error) setDailyPreview(null); else setDailyPreview(data); })
        .finally(() => setDailyPreviewLoading(false));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, editedBody, previewClassId, previewStudentId, passThreshold, activeDate, examIdsKey]);

  // 통합 발행 모달의 대상 인원 계산
  const targetCount = (() => {
    if (mode === 'student') return selectedStudentIds.length;
    // 단일 반 로스터: PER_EXAM, 세션 DAILY
    if (kind === 'PER_EXAM' || (kind === 'DAILY' && source === 'session')) {
      if (!activeClassId) return 0;
      return selectedClassIds.includes(activeClassId) ? activeClassStudents.length : 0;
    }
    // 다중 반: PERIODIC, 탭 DAILY
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
      if (kind === 'DAILY' && !activeDate) {
        toast('날짜를 선택하세요.', 'error');
        return;
      }
      const url = kind === 'PER_EXAM'
        ? '/api/reports/publish'
        : kind === 'DAILY'
          ? '/api/reports/publish-daily'
          : '/api/reports/publish-periodic';
      const targetIds = {
        classIds: mode === 'class' ? selectedClassIds : undefined,
        studentIds: mode === 'student' ? selectedStudentIds : undefined,
      };
      let payload: Record<string, unknown>;
      if (kind === 'DAILY') {
        // 반별 대상: 세션=고정 반, 탭=멀티선택 반(반단위는 서버 로스터, 개별은 반별로 묶음)
        const dailyTargets: Array<{ classId: string; studentIds?: string[] }> =
          source === 'session'
            ? [{ classId: activeClassId, studentIds: mode === 'student' ? selectedStudentIds : undefined }]
            : mode === 'class'
              ? selectedClassIds.map((cid) => ({ classId: cid }))
              : Object.keys(studentsByClass ?? {})
                  .map((cid) => ({
                    classId: cid,
                    studentIds: (studentsByClass?.[cid] ?? [])
                      .filter((s) => selectedStudentIds.includes(s.id))
                      .map((s) => s.id),
                  }))
                  .filter((t) => (t.studentIds?.length ?? 0) > 0);
        payload = {
          templateId,
          date: activeDate,
          targets: dailyTargets,
          examIds: dayExams.length > 0 ? selectedExamIds : undefined,
          passThreshold,
          summary,
          overrideBody: bodyDirty ? editedBody : undefined,
          overrideTitle: titleDirty ? editedTitle : undefined,
        };
      } else if (kind === 'PER_EXAM') {
        payload = {
          templateId,
          examId: activeExam!.id,
          ...targetIds,
          passThreshold,
          summary,
          overrideBody: bodyDirty ? editedBody : undefined,
          overrideTitle: titleDirty ? editedTitle : undefined,
        };
      } else if (isDirect) {
        // 양식 없이 직접 작성 — 카테고리·집계기간·임계값·본문·제목·차트를 직접 전송 (templateId 없음)
        payload = {
          ...targetIds,
          summary,
          periodMonths: directPeriodMonths,
          passThreshold: directPassThreshold,
          scopeFilter: directScope,
          bodyMarkdown: editedBody,
          title: editedTitle,
          layout: editedLayout,
        };
      } else {
        // 양식 모드 — 카테고리는 양식 값 고정(전송 안 함), 본문/제목/차트만 이번 발행 한정 override
        payload = {
          templateId,
          ...targetIds,
          summary,
          overrideBody: bodyDirty ? editedBody : undefined,
          overrideTitle: titleDirty ? editedTitle : undefined,
          overrideLayout: layoutDirty ? editedLayout : undefined,
        };
      }
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
      toast(
        `${data.count}명에게 리포트 발송 완료${data.skipped ? ` (${data.skipped}명 데이터 없어 제외)` : ''}`,
        'success',
      );
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
      title={
        source === 'exam' && examProp
          ? `${examProp.name} 리포트 발행`
          : source === 'session'
            ? `${sessionClassName ?? ''} ${sessionDate ?? ''} 수업 리포트 발행`.trim()
            : '리포트 발행'
      }
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
              {/* 시험별(PER_EXAM)은 숨김 — 수업/기간만 노출 */}
              {(['DAILY', 'PERIODIC'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={clsx(
                    'px-3 py-1.5 rounded-[6px] text-[11.5px] font-medium cursor-pointer',
                    kind === k ? 'bg-[#1a2535] text-white' : 'bg-[#f1f5f9] text-[#6b7280]',
                  )}
                >
                  {k === 'DAILY' ? '수업 리포트' : '기간 리포트'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 세션 진입(DAILY) — 반·날짜 고정 안내 */}
        {source === 'session' && (
          <div className="text-[12px] text-[#374151] bg-[#f1f5f9] rounded-[8px] px-3 py-2">
            <b>{activeClassName}</b> · {activeDate} 수업 리포트 (학생만 선택)
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

        {/* 'tab' & DAILY: 날짜만 선택 (반은 아래 대상에서 멀티선택) */}
        {source === 'tab' && kind === 'DAILY' && (
          <div>
            <label className="text-[11.5px] font-medium text-[#374151] block mb-1">날짜 선택</label>
            <input
              type="date"
              value={tabDate}
              onChange={(e) => setTabDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
            />
          </div>
        )}

        {/* 양식 선택 */}
        <div>
          <label className="text-[11.5px] font-medium text-[#374151] block mb-1">양식</label>
          {templates.length === 0 && (kind === 'PER_EXAM' || kind === 'DAILY') ? (
            <div className="text-[12px] text-[#ef4444]">
              발행 가능한 {kind === 'DAILY' ? '수업' : '시험별'} 양식이 없습니다.
              {' '}<a href="/classes/lessons" className="underline">양식 관리에서 만들기</a>
            </div>
          ) : (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
            >
              {kind === 'PERIODIC' && <option value={DIRECT}>양식 없이 직접 작성</option>}
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
          {isDirect && (
            <div className="text-[10.5px] text-[#9ca3af] mt-1">
              양식 없이 이번 발행만 직접 작성합니다. 아래에서 집계 기간·대상 카테고리·본문을 지정하세요.
            </div>
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
                  ? ((kind === 'PERIODIC' || (kind === 'DAILY' && source === 'tab'))
                      ? '반 단위'
                      : `반 전체${activeClassName ? ` (${activeClassName})` : ''}`)
                  : '개별 학생 선택'}
              </button>
            ))}
          </div>

          {/* PER_EXAM·세션 DAILY 학생 선택 — 해당 단일 반의 학생만 (탭 DAILY는 아래 멀티선택) */}
          {(kind === 'PER_EXAM' || (kind === 'DAILY' && source === 'session')) && mode === 'student' && (
            <div className="border border-[#e2e8f0] rounded-[8px] max-h-44 overflow-y-auto p-2">
              {activeClassStudents.length === 0 ? (
                <div className="text-[12px] text-[#9ca3af] p-2">{activeClassId ? '반에 활성 학생이 없습니다.' : (kind === 'DAILY' ? '먼저 반·날짜를 선택하세요.' : '먼저 반·시험을 선택하세요.')}</div>
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

          {/* 다중 반 멀티선택 — PERIODIC, 탭 DAILY */}
          {(kind === 'PERIODIC' || (kind === 'DAILY' && source === 'tab')) && mode === 'class' && (
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

          {/* 다중 반 학생 멀티선택 (반별 그룹) — PERIODIC, 탭 DAILY */}
          {(kind === 'PERIODIC' || (kind === 'DAILY' && source === 'tab')) && mode === 'student' && (
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

        {/* DAILY: 포함할 시험 — 그날 시험이 있으면 리포트에 넣을 시험 선택 (기본 전체) */}
        {kind === 'DAILY' && dayExams.length > 0 && (
          <div>
            <label className="text-[11.5px] font-medium text-[#374151] block mb-1.5">
              포함할 시험{' '}
              <span className="text-[#9ca3af] font-normal">({selectedExamIds.length}/{dayExams.length} 선택)</span>
            </label>
            <div className="border border-[#e2e8f0] rounded-[8px] max-h-40 overflow-y-auto p-2 space-y-2">
              {examGroups.map((g) => (
                <div key={g.classId}>
                  {examGroups.length > 1 && (
                    <div className="text-[10.5px] font-semibold text-[#6b7280] mt-1 mb-1">{g.className}</div>
                  )}
                  {g.exams.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 py-0.5 pl-1 cursor-pointer hover:bg-[#f4f6f8] rounded">
                      <input type="checkbox" checked={selectedExamIds.includes(e.id)} onChange={() => toggleExam(e.id)} />
                      <span className="text-[12.5px] text-[#111827] flex-1">{e.name}</span>
                      <span className="text-[10.5px] text-[#9ca3af]">{e.totalScore}점</span>
                    </label>
                  ))}
                </div>
              ))}
              <div className="border-t border-[#f1f5f9] mt-1 pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedExamIds(dayExams.map((e) => e.id))}
                  className="text-[11px] text-[#4fc3a1] cursor-pointer hover:underline"
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedExamIds([])}
                  className="text-[11px] text-[#6b7280] cursor-pointer hover:underline"
                >
                  선택 해제
                </button>
              </div>
            </div>
            <div className="text-[10.5px] text-[#9ca3af] mt-1">
              선택한 시험이 <code className="bg-[#f1f5f9] px-1 rounded">{'{{시험결과}}'}</code> 토큰에 모두 표시됩니다. 전체 해제하면 시험은 리포트에 들어가지 않습니다.
            </div>
          </div>
        )}

        {/* PERIODIC: 집계 설정(직접 작성 시 입력) + 대상 시험 카테고리 */}
        {kind === 'PERIODIC' && templateId && (
          <div className="space-y-3">
            {isDirect && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11.5px] font-medium text-[#374151] block mb-1">집계 기간 (개월)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} max={60}
                      value={directPeriodMonths}
                      onChange={(e) => setDirectPeriodMonths(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
                    />
                    <span className="text-[11.5px] text-[#6b7280]">개월 이전부터 오늘까지</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11.5px] font-medium text-[#374151] block mb-1">합격 임계값 (%)</label>
                  <input
                    type="number" min={0} max={100}
                    value={directPassThreshold}
                    onChange={(e) => setDirectPassThreshold(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-[11.5px] font-medium text-[#374151] block mb-1">
                대상 시험 카테고리{' '}
                <span className="text-[#9ca3af] font-normal">
                  ({scopeCount(isDirect ? directScope : templateScope) === 0
                    ? '전체 시험'
                    : `${scopeCount(isDirect ? directScope : templateScope)}개 선택됨`})
                </span>
                {!isDirect && (
                  <span className="ml-1 text-[10.5px] text-[#6b7280] bg-[#f1f5f9] rounded px-1.5 py-0.5">양식 고정</span>
                )}
              </label>
              <CategoryScopeTree
                key={templateId}
                categories={categories}
                value={isDirect ? directScope : templateScope}
                onChange={setDirectScope}
                readOnly={!isDirect}
                maxHeightClass="max-h-44"
              />
              <div className="text-[10.5px] text-[#9ca3af] mt-1">
                {isDirect
                  ? 'Level 1·2·3 어느 레벨이든 선택 가능. 선택한 카테고리에 속한 시험만 집계 — 비워두면 전체 대상.'
                  : '양식에서 지정한 카테고리입니다. 발행 화면에서는 수정할 수 없습니다.'}
              </div>
            </div>
          </div>
        )}

        {/* 합격 임계값 (PER_EXAM만) + 요약 */}
        <div className="grid grid-cols-2 gap-3">
          {(kind === 'PER_EXAM' || kind === 'DAILY') && (
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
          <div className={(kind === 'PER_EXAM' || kind === 'DAILY') ? '' : 'col-span-2'}>
            <label className="text-[11.5px] font-medium text-[#374151] block mb-1">요약 (선택)</label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={kind === 'PERIODIC' ? '비워두면 평균/시험수로 자동 생성' : kind === 'DAILY' ? '비워두면 태도·과제로 자동 생성' : '비워두면 점수·순위로 자동 생성'}
              className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
            />
          </div>
        </div>

        {/* 제목 편집 (양식 이름이 기본값, 이번 발행만 한정 수정) */}
        {templateId && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11.5px] font-medium text-[#374151]">
                제목 {hasTemplate && titleDirty && <span className="text-[#0D9E7A] font-semibold ml-1">· 수정됨</span>}
              </label>
              {hasTemplate && titleDirty && (
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
              placeholder={isDirect ? '리포트 제목을 입력하세요' : '양식 이름이 기본값'}
              className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
            />
            <div className="text-[10.5px] text-[#9ca3af] mt-1">
              학부모/학생 PWA 리포트 리스트에 노출되는 제목입니다. 양식 이름은 변경되지 않고, 이번 발행에만 적용됩니다.
            </div>
          </div>
        )}

        {/* 본문 편집 (시험별·기간 모두 — 이번 발행만 한정 수정) */}
        {templateId && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11.5px] font-medium text-[#374151]">
                본문 {hasTemplate && bodyDirty && <span className="text-[#0D9E7A] font-semibold ml-1">· 수정됨</span>}
              </label>
              {hasTemplate && bodyDirty && (
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
                placeholder={isDirect ? '직접 작성할 본문을 입력하세요. 우측 토큰을 클릭해 삽입할 수 있습니다.' : '양식을 선택하면 본문이 자동으로 채워집니다. 이번 발행만 한정으로 수정할 수 있습니다.'}
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
                {hasTemplate && layoutDirty && <span className="text-[#0D9E7A] font-semibold ml-1">· 수정됨</span>}
              </label>
              {hasTemplate && layoutDirty && (
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

        {/* 미리보기 (DAILY) */}
        {kind === 'DAILY' && (
          <div>
            <label className="text-[11.5px] font-medium text-[#374151] block mb-1">
              미리보기 {dailyTarget ? '(첫 번째 대상 학생 기준)' : ''}
            </label>
            <div className="bg-[#f9fafb] border border-[#e2e8f0] rounded-[8px] p-3 min-h-[80px] text-[12.5px] whitespace-pre-wrap leading-relaxed">
              {dailyPreviewLoading && <span className="text-[#9ca3af]">불러오는 중…</span>}
              {!dailyPreviewLoading && dailyPreview && dailyPreview.renderedBody}
              {!dailyPreviewLoading && !dailyPreview && (
                <span className="text-[#9ca3af]">반·날짜·대상 학생을 선택하면 미리보기가 표시됩니다.</span>
              )}
            </div>
          </div>
        )}

        {kind === 'PERIODIC' && (
          <>
            <div className="text-[11.5px] text-[#9ca3af]">
              {hasTemplate
                ? '발행 시점 기준으로 양식의 집계 개월 수에 맞춰 자동 산정됩니다. 임계값·집계 기간은 양식 설정값을 사용합니다.'
                : '발행 시점 기준으로 위에서 지정한 집계 기간에 맞춰 자동 산정됩니다.'}
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
