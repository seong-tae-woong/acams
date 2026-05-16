'use client';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/shared/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import { Plus, Trash2, Save, X, Info, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { CHART_PRESETS, type ChartPresetKey } from '@/components/reports/charts';
import TokenPanel, { insertTokenAtCursor } from '@/components/reports/TokenPanel';
import { useClassStore } from '@/lib/stores/classStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { StudentStatus } from '@/lib/types/student';

interface LayoutBlock { type: 'chart'; preset: ChartPresetKey; title?: string }

type Kind = 'PER_EXAM' | 'PERIODIC';
interface ScopeFilter {
  category1Ids?: string[];
  category2Ids?: string[];
  category3Ids?: string[];
  subjects?: string[];
}

interface Template {
  id: string;
  name: string;
  alias: string;
  kind: Kind;
  bodyMarkdown: string;
  passThreshold: number;
  periodMonths: number | null;
  isActive: boolean;
  layout?: unknown;
  scopeFilter?: unknown;
}

// 발행 시점 기준 N개월 이전 1일을 계산하는 헬퍼 (i 툴팁용)
function computeStartLabel(months: number, ref: Date = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth() - months, 1);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
function computeEndLabel(ref: Date = new Date()): string {
  return `${ref.getFullYear()}년 ${ref.getMonth() + 1}월 ${ref.getDate()}일`;
}

const PAGE_SIZE = 10;

export default function ReportTemplatesEditor() {
  const [kind, setKind] = useState<Kind>('PER_EXAM');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 편집 폼 상태
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [body, setBody] = useState('');
  const [passThreshold, setPassThreshold] = useState(70);
  const [periodMonths, setPeriodMonths] = useState<number>(1);
  const [layout, setLayout] = useState<LayoutBlock[]>([]);
  const [scopeCategory1Ids, setScopeCategory1Ids] = useState<string[]>([]);
  const [scopeCategory2Ids, setScopeCategory2Ids] = useState<string[]>([]);
  const [scopeCategory3Ids, setScopeCategory3Ids] = useState<string[]>([]);
  const [expandedCat1, setExpandedCat1] = useState<Set<string>>(new Set());
  const [expandedCat2, setExpandedCat2] = useState<Set<string>>(new Set());

  // 데이터
  const { classes, fetchClasses } = useClassStore();
  const { students, fetchStudents } = useStudentStore();
  const { exams, categories, fetchExams, fetchCategories } = useGradeStore();
  useEffect(() => { fetchClasses(); fetchStudents(); fetchExams(); fetchCategories(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cat1List = categories.filter((c) => c.level === 1);
  const cat2ByParent = (parentId: string) => categories.filter((c) => c.level === 2 && c.parentId === parentId);
  const cat3ByParent = (parentId: string) => categories.filter((c) => c.level === 3 && c.parentId === parentId);

  const studentsByClass: Record<string, { id: string; name: string }[]> = {};
  for (const c of classes) {
    studentsByClass[c.id] = students
      .filter((s) => s.status === StudentStatus.ACTIVE && (s.classes ?? []).includes(c.id))
      .map((s) => ({ id: s.id, name: s.name }));
  }

  // 미리보기용 시험·학생 선택
  const [previewExamId, setPreviewExamId] = useState<string>('');
  const [previewStudentId, setPreviewStudentId] = useState<string>('');
  const [previewText, setPreviewText] = useState<string>('');
  const [previewError, setPreviewError] = useState<string>('');

  const previewExam = exams.find((e) => e.id === previewExamId);
  const previewClassStudents = previewExam ? studentsByClass[previewExam.classId] ?? [] : [];
  useEffect(() => {
    if (previewExamId && !previewClassStudents.find((s) => s.id === previewStudentId)) {
      setPreviewStudentId(previewClassStudents[0]?.id ?? '');
    }
  }, [previewExamId, previewClassStudents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 디바운스 미리보기 fetch (PER_EXAM only)
  useEffect(() => {
    if (kind !== 'PER_EXAM' || !previewExamId || !previewStudentId || !body) {
      setPreviewText('');
      setPreviewError('');
      return;
    }
    setPreviewError('');
    const handle = setTimeout(async () => {
      try {
        const res = await fetch('/api/reports/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examId: previewExamId,
            studentId: previewStudentId,
            bodyMarkdown: body,
            passThreshold,
          }),
        });
        const data = await res.json();
        if (data.error) setPreviewError(data.error);
        else setPreviewText(data.renderedBody ?? '');
      } catch {
        setPreviewError('미리보기 불러오기 실패');
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [kind, body, previewExamId, previewStudentId, passThreshold]);

  const selected = templates.find((t) => t.id === selectedId);

  // 양식 목록 1페이지 로드 (등록일 최신순)
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communication/report-templates?kind=${kind}&skip=0&take=${PAGE_SIZE}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTemplates(data);
        setHasMore(data.length === PAGE_SIZE);
      }
    } finally {
      setLoading(false);
    }
  };

  // 양식 목록 다음 페이지 로드 (스크롤)
  const loadMoreTemplates = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/communication/report-templates?kind=${kind}&skip=${templates.length}&take=${PAGE_SIZE}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTemplates((prev) => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    setSelectedId(null);
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setAlias(selected.alias ?? '');
      setBody(selected.bodyMarkdown);
      setPassThreshold(selected.passThreshold);
      setPeriodMonths(selected.periodMonths ?? 1);
      setLayout(Array.isArray(selected.layout) ? (selected.layout as LayoutBlock[]) : []);
      const sf = (selected.scopeFilter ?? {}) as ScopeFilter;
      const c1 = Array.isArray(sf.category1Ids) ? sf.category1Ids : [];
      const c2 = Array.isArray(sf.category2Ids) ? sf.category2Ids : [];
      const c3 = Array.isArray(sf.category3Ids) ? sf.category3Ids : [];
      setScopeCategory1Ids(c1);
      setScopeCategory2Ids(c2);
      setScopeCategory3Ids(c3);
      setExpandedCat1(new Set(c1));
      setExpandedCat2(new Set(c2));
    } else {
      setName('');
      setAlias('');
      setBody('');
      setPassThreshold(70);
      setPeriodMonths(1);
      setLayout([]);
      setScopeCategory1Ids([]);
      setScopeCategory2Ids([]);
      setScopeCategory3Ids([]);
      setExpandedCat1(new Set());
      setExpandedCat2(new Set());
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const insertToken = (token: string) => insertTokenAtCursor(textareaRef, body, setBody, token);

  const handleNew = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/communication/report-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '새 양식',
          kind,
          bodyMarkdown: '',
          passThreshold: 70,
          periodMonths: kind === 'PERIODIC' ? 1 : null,
        }),
      });
      if (!res.ok) {
        toast('생성 실패', 'error');
        return;
      }
      const created = await res.json();
      // 새 양식은 등록일 최신순 목록 맨 앞에 추가
      setTemplates((prev) => [created, ...prev]);
      setSelectedId(created.id);
      toast('새 양식 생성됨', 'success');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!name.trim()) {
      toast('이름을 입력하세요.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/communication/report-templates/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          alias,
          bodyMarkdown: body,
          passThreshold,
          periodMonths: kind === 'PERIODIC' ? periodMonths : null,
          layout: kind === 'PERIODIC' ? layout : [],
          scopeFilter: kind === 'PERIODIC' ? {
            category1Ids: scopeCategory1Ids,
            category2Ids: scopeCategory2Ids,
            category3Ids: scopeCategory3Ids,
          } : {},
        }),
      });
      if (!res.ok) {
        toast('저장 실패', 'error');
        return;
      }
      // 전체 재조회 대신 현재 목록에서 해당 양식만 갱신 (페이지 위치 유지)
      const updated = await res.json();
      setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...updated } : t)));
      toast('저장됨', 'success');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`"${selected.name}" 양식을 삭제할까요?`)) return;
    const res = await fetch(`/api/communication/report-templates/${selected.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data.error || '삭제 실패', 'error');
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== selected.id));
    setSelectedId(null);
    toast('삭제됨', 'success');
  };

  const toggleCategory1 = (id: string) => {
    setScopeCategory1Ids((prev) => {
      if (prev.includes(id)) {
        // 해제 시 자식들도 해제
        const children2 = cat2ByParent(id).map((c) => c.id);
        const children3 = children2.flatMap((c2id) => cat3ByParent(c2id).map((c) => c.id));
        setScopeCategory2Ids((p2) => p2.filter((x) => !children2.includes(x)));
        setScopeCategory3Ids((p3) => p3.filter((x) => !children3.includes(x)));
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };
  const toggleCategory2 = (id: string) => {
    setScopeCategory2Ids((prev) => {
      if (prev.includes(id)) {
        const children3 = cat3ByParent(id).map((c) => c.id);
        setScopeCategory3Ids((p3) => p3.filter((x) => !children3.includes(x)));
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };
  const toggleCategory3 = (id: string) => {
    setScopeCategory3Ids((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleExpand1 = (id: string) => {
    setExpandedCat1((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleExpand2 = (id: string) => {
    setExpandedCat2((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalSelected = scopeCategory1Ids.length + scopeCategory2Ids.length + scopeCategory3Ids.length;
  const scopeLabel = totalSelected === 0
    ? '전체 시험'
    : `${totalSelected}개 선택됨`;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 좌측: 양식 목록 */}
      <div className="w-60 shrink-0 border-r border-[#e2e8f0] bg-white flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[#f1f5f9] flex gap-1">
          {(['PER_EXAM', 'PERIODIC'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={clsx(
                'flex-1 px-2 py-1.5 rounded-[6px] text-[11.5px] font-medium cursor-pointer',
                kind === k ? 'bg-[#1a2535] text-white' : 'bg-[#f1f5f9] text-[#6b7280]',
              )}
            >
              {k === 'PER_EXAM' ? '시험별' : '주기별'}
            </button>
          ))}
        </div>
        <div className="px-3 py-2 border-b border-[#f1f5f9]">
          <Button variant="default" size="sm" onClick={handleNew} disabled={saving}>
            <Plus size={13} /> 새 양식
          </Button>
        </div>
        <div
          className="flex-1 overflow-y-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) loadMoreTemplates();
          }}
        >
          {loading && <LoadingSpinner />}
          {!loading && templates.length === 0 && (
            <div className="p-4 text-[12px] text-[#9ca3af] text-center">양식 없음</div>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={clsx(
                'w-full text-left px-3 py-2.5 border-b border-[#f1f5f9] cursor-pointer',
                selectedId === t.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
              )}
            >
              <div className="text-[12.5px] font-medium text-[#111827] truncate">{t.name}</div>
              {t.alias && (
                <div className="text-[10.5px] text-[#0D9E7A] truncate mt-0.5">@ {t.alias}</div>
              )}
              <div className="text-[10.5px] text-[#9ca3af] mt-0.5">
                {t.kind === 'PER_EXAM' ? '시험별' : `주기별 · 최근 ${t.periodMonths ?? '?'}개월`}
              </div>
            </button>
          ))}
          {loadingMore && (
            <div className="p-3 text-center text-[11px] text-[#9ca3af]">불러오는 중…</div>
          )}
        </div>
      </div>

      {/* 가운데: 편집 영역 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!selected && (
          <div className="text-[13px] text-[#9ca3af] text-center pt-20">
            왼쪽에서 양식을 선택하거나 "새 양식"을 만드세요.
          </div>
        )}
        {selected && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="양식 이름 (학부모에게도 노출)"
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-[8px] text-[14px] font-semibold"
                />
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="별칭 (선택) — 발행 화면에서만 보이는 원장용 메모. 예: 1학년 영어, 신입반용"
                  className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px] text-[#0D9E7A] placeholder:text-[#9ca3af]"
                />
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                  <Save size={13} /> 저장
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete}>
                  <Trash2 size={13} /> 삭제
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <div className="text-[10.5px] text-[#9ca3af] mt-1">
                  {kind === 'PER_EXAM'
                    ? `백분율 ≥ 임계값이면 {{합격/불합격}} → "합격"`
                    : `기간평균 ≥ 임계값이면 {{합격/불합격}} → "합격"`}
                </div>
              </div>
              {kind === 'PERIODIC' && (
                <div>
                  <label className="text-[11.5px] font-medium text-[#374151] mb-1 flex items-center gap-1">
                    집계 기간 (개월)
                    <span
                      className="relative group cursor-help text-[#9ca3af] hover:text-[#0D9E7A]"
                      tabIndex={0}
                    >
                      <Info size={12} />
                      <span className="absolute left-0 top-5 z-10 hidden group-hover:block group-focus:block w-64 p-2 bg-[#1a2535] text-white text-[10.5px] rounded-[6px] shadow-lg leading-relaxed">
                        오늘 기준 <b>{periodMonths}개월 이전의 1일</b>부터 <b>오늘</b>까지 집계됩니다.
                        <br />
                        예: <b>{computeStartLabel(periodMonths)} ~ {computeEndLabel()}</b>
                      </span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={periodMonths}
                      onChange={(e) => setPeriodMonths(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
                    />
                    <span className="text-[11.5px] text-[#6b7280]">개월 이전부터 오늘까지</span>
                  </div>
                </div>
              )}
            </div>

            {/* PERIODIC 전용: 대상 시험 카테고리 (계층 트리) */}
            {kind === 'PERIODIC' && (
              <div>
                <label className="text-[11.5px] font-medium text-[#374151] block mb-1">
                  대상 시험 카테고리 <span className="text-[#9ca3af] font-normal">({scopeLabel})</span>
                </label>
                <div className="border border-[#e2e8f0] rounded-[8px] p-2 bg-white max-h-60 overflow-y-auto">
                  {cat1List.length === 0 ? (
                    <div className="text-[11.5px] text-[#9ca3af] p-1">등록된 카테고리 없음</div>
                  ) : (
                    <div className="space-y-0.5">
                      {cat1List.map((c1) => {
                        const cat2s = cat2ByParent(c1.id);
                        const c1Expanded = expandedCat1.has(c1.id);
                        const c1Checked = scopeCategory1Ids.includes(c1.id);
                        return (
                          <div key={c1.id}>
                            <div className="flex items-center gap-1 hover:bg-[#f9fafb] rounded px-1 py-0.5">
                              {cat2s.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand1(c1.id)}
                                  className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                                >
                                  {c1Expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                              ) : (
                                <span className="w-3" />
                              )}
                              <label className="flex items-center gap-1.5 cursor-pointer flex-1 text-[12px]">
                                <input
                                  type="checkbox"
                                  checked={c1Checked}
                                  onChange={() => toggleCategory1(c1.id)}
                                  className="w-3 h-3"
                                />
                                <span className="font-medium text-[#111827]">{c1.name}</span>
                                <span className="text-[10px] text-[#9ca3af]">L1</span>
                              </label>
                            </div>
                            {c1Expanded && cat2s.map((c2) => {
                              const cat3s = cat3ByParent(c2.id);
                              const c2Expanded = expandedCat2.has(c2.id);
                              const c2Checked = scopeCategory2Ids.includes(c2.id);
                              return (
                                <div key={c2.id} className="pl-5">
                                  <div className="flex items-center gap-1 hover:bg-[#f9fafb] rounded px-1 py-0.5">
                                    {cat3s.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpand2(c2.id)}
                                        className="text-[#9ca3af] hover:text-[#374151] cursor-pointer"
                                      >
                                        {c2Expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                      </button>
                                    ) : (
                                      <span className="w-3" />
                                    )}
                                    <label className="flex items-center gap-1.5 cursor-pointer flex-1 text-[12px]">
                                      <input
                                        type="checkbox"
                                        checked={c2Checked}
                                        onChange={() => toggleCategory2(c2.id)}
                                        className="w-3 h-3"
                                      />
                                      <span className="text-[#374151]">{c2.name}</span>
                                      <span className="text-[10px] text-[#9ca3af]">L2</span>
                                    </label>
                                  </div>
                                  {c2Expanded && cat3s.map((c3) => {
                                    const c3Checked = scopeCategory3Ids.includes(c3.id);
                                    return (
                                      <div key={c3.id} className="pl-5">
                                        <label className="flex items-center gap-1.5 cursor-pointer hover:bg-[#f9fafb] rounded px-1 py-0.5 text-[12px]">
                                          <span className="w-3" />
                                          <input
                                            type="checkbox"
                                            checked={c3Checked}
                                            onChange={() => toggleCategory3(c3.id)}
                                            className="w-3 h-3"
                                          />
                                          <span className="text-[#374151]">{c3.name}</span>
                                          <span className="text-[10px] text-[#9ca3af]">L3</span>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="text-[10.5px] text-[#9ca3af] mt-1">
                  Level 1·2·3 어느 레벨이든 선택 가능 (옵션). 선택한 카테고리에 속한 시험만 집계 — 비워두면 전체 대상.
                </div>
              </div>
            )}

            <div>
              <label className="text-[11.5px] font-medium text-[#374151] block mb-1">
                본문 (오른쪽 토큰을 클릭해 커서 위치에 삽입)
              </label>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={kind === 'PERIODIC' ? 8 : 10}
                placeholder={kind === 'PERIODIC'
                  ? '예) {{학생}} 학생, {{기간}} {{대상카테고리}} 시험 평균은 {{기간평균}}점이며, 응시 {{기간시험수}}회입니다.'
                  : '예) {{학생}} 학생, 이번 {{시험명}}에서 {{점수}}점({{만점}}점 만점)을 받아\n반 {{반인원}}명 중 {{순위}}등을 기록했습니다.\n반 평균 {{반평균}}점 대비 {{평균차이}}점 {{우수/저조}}한 결과입니다.'}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-[8px] text-[13px] font-mono leading-relaxed"
              />
            </div>

            {/* 실시간 미리보기 (PER_EXAM only) */}
            {kind === 'PER_EXAM' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11.5px] font-medium text-[#374151]">실시간 미리보기</label>
                  <span className="text-[10.5px] text-[#9ca3af]">실제 학생 데이터로 토큰 치환</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={previewExamId}
                    onChange={(e) => setPreviewExamId(e.target.value)}
                    className="px-2 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12px]"
                  >
                    <option value="">시험 선택...</option>
                    {exams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({new Date(e.date).toISOString().slice(0, 10)})
                      </option>
                    ))}
                  </select>
                  <select
                    value={previewStudentId}
                    onChange={(e) => setPreviewStudentId(e.target.value)}
                    disabled={!previewExamId}
                    className="px-2 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12px] disabled:bg-[#f9fafb]"
                  >
                    <option value="">학생 선택...</option>
                    {previewClassStudents.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-[#f9fafb] border border-[#e2e8f0] rounded-[8px] p-3 min-h-[80px] text-[12.5px] whitespace-pre-wrap leading-relaxed">
                  {!previewExamId || !previewStudentId ? (
                    <span className="text-[#9ca3af]">시험과 학생을 선택하면 치환 결과가 여기에 표시됩니다.</span>
                  ) : previewError ? (
                    <span className="text-[#ef4444]">{previewError}</span>
                  ) : !body ? (
                    <span className="text-[#9ca3af]">본문을 입력하세요.</span>
                  ) : (
                    previewText || <span className="text-[#9ca3af]">불러오는 중...</span>
                  )}
                </div>
              </div>
            )}

            {/* PERIODIC: 차트 블록 편집 */}
            {kind === 'PERIODIC' && (
              <div>
                <label className="text-[11.5px] font-medium text-[#374151] block mb-1.5">
                  차트 블록 ({layout.length}개)
                </label>
                <div className="space-y-2 mb-2">
                  {layout.length === 0 && (
                    <div className="text-[12px] text-[#9ca3af] py-3 text-center border border-dashed border-[#e2e8f0] rounded-[8px]">
                      아래에서 차트를 추가하세요
                    </div>
                  )}
                  {layout.map((block, i) => {
                    const meta = CHART_PRESETS.find((p) => p.key === block.preset);
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 bg-[#f9fafb] border border-[#e2e8f0] rounded-[8px]">
                        <span className="text-[11.5px] text-[#9ca3af] w-5">{i + 1}.</span>
                        <input
                          value={block.title ?? ''}
                          onChange={(e) => {
                            const next = [...layout];
                            next[i] = { ...block, title: e.target.value };
                            setLayout(next);
                          }}
                          placeholder={meta?.label ?? block.preset}
                          className="flex-1 px-2 py-1 text-[12px] border border-[#e2e8f0] rounded-[6px] bg-white"
                        />
                        <span className="text-[10.5px] text-[#6b7280] bg-white px-1.5 py-0.5 rounded border border-[#e2e8f0]">
                          {meta?.label ?? block.preset}
                        </span>
                        <button
                          onClick={() => setLayout(layout.filter((_, k) => k !== i))}
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
                        onClick={() => setLayout([...layout, { type: 'chart', preset: p.key }])}
                        title={p.description}
                        className="px-2.5 py-1 bg-white border border-[#e2e8f0] rounded-[6px] text-[11.5px] text-[#374151] hover:border-[#4fc3a1] hover:text-[#0D9E7A] cursor-pointer"
                      >
                        + {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 우측: 토큰 버튼 패널 */}
      {selected && (
        <div className="w-56 shrink-0 border-l border-[#e2e8f0] bg-[#f9fafb]">
          <TokenPanel onInsert={insertToken} variant="sidebar" kind={kind} />
        </div>
      )}

    </div>
  );
}
