'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────
type TabId = 'tags' | 'series' | 'target' | 'cond' | 'exam' | 'retry';

type Tag = { id?: string; label: string; bg: string; color: string; border: string };
type TagType = 'subject' | 'level' | 'grade' | 'etc';

type Lecture = {
  id: string;
  title: string;
  subjects: string[];
  levels: string[];
  targetGrades: string[];
  etcTags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  seriesId: string | null;
  episodeNumber: number | null;
  orderIndex: number;
};

type Series = {
  id: string;
  title: string;
  orderIndex: number;
  status: 'DRAFT' | 'PUBLISHED';
};

// 시험 출제 타입
type QuizOption   = { id?: string; text: string; isCorrect: boolean };
type QuizQuestion = { id?: string; text: string; score: number; options: QuizOption[] };
type QuizData     = { passScore: number; maxTries: number; examCond: string; questions: QuizQuestion[] } | null;

// 재응시 관리 타입
type RetryPending = { studentId: string; student: string; lectureTitle: string; quizId: string; tries: number; maxTries: number; bestScore: number };
type RetryHistory = { id: string; student: string; lectureTitle: string; allowedBy: string; createdAt: string; result: string; passed: boolean };

// ─── Tab config ───────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: 'tags',   label: '강의 분류/태그' },
  { id: 'series', label: '시리즈 구성' },
  { id: 'target', label: '수강 대상 지정' },
  { id: 'cond',   label: '이수 조건 설정' },
  { id: 'exam',   label: '시험 출제' },
  { id: 'retry',  label: '재응시 관리' },
];

// ─── Tag defaults ─────────────────────────────────────────────
const DEFAULT_SUBJECTS: Tag[] = [
  { label: '수학', bg: '#DBEAFE', color: '#1d4ed8', border: '#93c5fd' },
  { label: '영어', bg: '#D1FAE5', color: '#065f46', border: '#6ee7b7' },
  { label: '국어', bg: '#FEF3C7', color: '#92400e', border: '#fcd34d' },
  { label: '과학', bg: '#FEE2E2', color: '#991b1b', border: '#fca5a5' },
];
const DEFAULT_LEVELS: Tag[] = [
  { label: '기초',   bg: '#E1F5EE', color: '#065f46', border: '#4fc3a1' },
  { label: '심화',   bg: '#EEEDFE', color: '#534AB7', border: '#a78bfa' },
  { label: '최상위', bg: '#FEF9C3', color: '#713f12', border: '#fde047' },
];
const DEFAULT_GRADES: Tag[] = [
  '초1','초2','초3','초4','초5','초6','중1',
].map((g) => ({ label: g, bg: '#f1f5f9', color: '#374151', border: '#e2e8f0' }));
const CUSTOM_STYLE = { bg: '#F5F3FF', color: '#6D28D9', border: '#C4B5FD' };

const SUBJECT_MAP: Record<string, Pick<Tag, 'bg' | 'color'>> = {
  '수학': { bg: '#DBEAFE', color: '#1d4ed8' },
  '영어': { bg: '#D1FAE5', color: '#065f46' },
  '국어': { bg: '#FEF3C7', color: '#92400e' },
  '과학': { bg: '#FEE2E2', color: '#991b1b' },
};
const LEVEL_MAP: Record<string, Pick<Tag, 'bg' | 'color'>> = {
  '기초':   { bg: '#E1F5EE', color: '#065f46' },
  '심화':   { bg: '#EEEDFE', color: '#534AB7' },
  '최상위': { bg: '#FEF9C3', color: '#713f12' },
};

// ─── 시험 출제 보기 번호 ──────────────────────────────────────
const NUMS = ['①','②','③','④','⑤'];

// 학년 숫자(1~12) → 표기(초1~고3)
function gradeLabel(g: number): string {
  if (g >= 1 && g <= 6)   return `초${g}`;
  if (g >= 7 && g <= 9)   return `중${g - 6}`;
  if (g >= 10 && g <= 12) return `고${g - 9}`;
  return `${g}학년`;
}

// ─── Helpers ─────────────────────────────────────────────────
function lectureTags(lec: Pick<Lecture, 'subjects' | 'levels' | 'targetGrades' | 'etcTags'>) {
  return [
    ...lec.subjects.map((s) => ({ label: s, ...(SUBJECT_MAP[s] ?? CUSTOM_STYLE) })),
    ...lec.levels.map((l) => ({ label: l, ...(LEVEL_MAP[l] ?? CUSTOM_STYLE) })),
    ...lec.targetGrades.map((g) => ({ label: g, bg: '#f1f5f9', color: '#374151' })),
    ...(lec.etcTags ?? []).map((e) => ({ label: e, ...CUSTOM_STYLE })),
  ];
}

// ─── TagGroup ─────────────────────────────────────────────────
function TagGroup({
  title, tags, onDelete, onAdd, inputPlaceholder,
}: {
  title: string;
  tags: Tag[];
  onDelete: (tag: Tag) => Promise<void>;
  onAdd: (label: string) => Promise<void>;
  inputPlaceholder: string;
}) {
  const [inputVal, setInputVal] = useState('');
  const [adding,   setAdding]   = useState(false);

  const handleAdd = async () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    setAdding(true);
    try { await onAdd(trimmed); setInputVal(''); }
    finally { setAdding(false); }
  };

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden shrink-0">
      <div className="px-4 py-3 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">{title}</div>
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5 mb-3 max-h-[110px] overflow-y-auto pr-1">
          {tags.map((t) => (
            <span
              key={t.id ?? t.label}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-medium"
              style={{ background: t.bg, color: t.color, border: `1.5px solid ${t.border}` }}
            >
              {t.label}
              {t.id && (
                <span className="cursor-pointer opacity-60 hover:opacity-100 text-[12px]" onClick={() => onDelete(t)}>×</span>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text" value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !adding && handleAdd()}
            placeholder={inputPlaceholder}
            className="flex-1 text-[12.5px] px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
          />
          <button
            onClick={handleAdd} disabled={adding || !inputVal.trim()}
            className="px-3 py-1.5 rounded-[8px] text-[11.5px] font-medium text-white disabled:opacity-50"
            style={{ background: '#5B4FBE' }}
          >
            {adding ? '저장 중' : '+ 추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LecturePanel ─────────────────────────────────────────────
function LecturePanel({ lectures, loading, selectedId, onSelect, condMode }: {
  lectures: Lecture[];
  loading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  condMode: boolean;
}) {
  return (
    <div className="w-[240px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex flex-col">
      <div className="px-3.5 py-2.5 border-b border-[#f1f5f9] text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">강의 선택</div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
        ) : lectures.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 강의가 없습니다</p>
        ) : (
          lectures.map((l) => {
            const meta = [...l.subjects, ...l.levels].join(' · ') || '—';
            return (
              <div
                key={l.id}
                onClick={() => onSelect(l.id)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#f1f5f9] cursor-pointer hover:bg-gray-50 last:border-none"
                style={selectedId === l.id ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 11 } : {}}
              >
                <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                  <span style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '9px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-[#111827] truncate">{l.title}</p>
                  <p className="text-[10.5px] text-[#9ca3af]">{condMode ? '이수 조건 미설정' : meta}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Tab: 강의 분류/태그 ──────────────────────────────────────
function TagsContent({ lectures, loading }: { lectures: Lecture[]; loading: boolean }) {
  // ── 전역 태그 목록 (학원 커스텀 포함)
  const [subjects, setSubjects] = useState<Tag[]>(DEFAULT_SUBJECTS);
  const [levels,   setLevels]   = useState<Tag[]>(DEFAULT_LEVELS);
  const [grades,   setGrades]   = useState<Tag[]>(DEFAULT_GRADES);
  const [etcs,     setEtcs]     = useState<Tag[]>([]);

  // ── 선택 강의 & 편집 중인 태그
  const [selectedId,    setSelectedId]    = useState<string>('');
  const [editSubjects,  setEditSubjects]  = useState<string[]>([]);
  const [editLevels,    setEditLevels]    = useState<string[]>([]);
  const [editGrades,    setEditGrades]    = useState<string[]>([]);
  const [editEtcs,      setEditEtcs]      = useState<string[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [showTagModal,  setShowTagModal]  = useState(false);

  // 전역 태그 로드
  useEffect(() => {
    fetch('/api/lectures/tags')
      .then((r) => r.json())
      .then((tagData) => {
        if (!Array.isArray(tagData)) return;
        const make = (t: { id: string; label: string }): Tag => ({ ...CUSTOM_STYLE, ...t });
        setSubjects([...DEFAULT_SUBJECTS, ...tagData.filter((t) => t.tagType === 'subject').map(make)]);
        setLevels([...DEFAULT_LEVELS,     ...tagData.filter((t) => t.tagType === 'level').map(make)]);
        setGrades([...DEFAULT_GRADES,     ...tagData.filter((t) => t.tagType === 'grade').map(make)]);
        setEtcs(tagData.filter((t) => t.tagType === 'etc').map(make));
      })
      .catch(() => {});
  }, []);

  // 강의 목록 로드 시 첫 번째 자동 선택
  useEffect(() => {
    if (lectures.length > 0 && !selectedId) {
      const first = lectures[0];
      setSelectedId(first.id);
      setEditSubjects(first.subjects);
      setEditLevels(first.levels);
      setEditGrades(first.targetGrades);
      setEditEtcs(first.etcTags ?? []);
    }
  }, [lectures, selectedId]);

  const selectLecture = (lec: Lecture) => {
    setSelectedId(lec.id);
    setEditSubjects(lec.subjects);
    setEditLevels(lec.levels);
    setEditGrades(lec.targetGrades);
    setEditEtcs(lec.etcTags ?? []);
    setSaved(false);
  };

  const toggle = (
    arr: string[],
    set: React.Dispatch<React.SetStateAction<string[]>>,
    label: string,
  ) => {
    set(arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label]);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/lectures/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: editSubjects, levels: editLevels, targetGrades: editGrades, etcTags: editEtcs }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 전역 태그 추가/삭제
  const makeAdder = (
    tagType: TagType,
    currentTags: Tag[],
    setList: React.Dispatch<React.SetStateAction<Tag[]>>,
  ) => async (label: string) => {
    if (currentTags.some((t) => t.label === label)) { alert('이미 존재하는 태그입니다.'); return; }
    const res = await fetch('/api/lectures/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, tagType }),
    });
    if (res.ok) {
      const newTag = await res.json();
      setList((p) => [...p, { ...CUSTOM_STYLE, id: newTag.id, label: newTag.label }]);
    } else {
      const err = await res.json();
      alert(err.error ?? '태그 추가에 실패했습니다.');
    }
  };

  const makeDeleter = (setList: React.Dispatch<React.SetStateAction<Tag[]>>) =>
    async (tag: Tag) => {
      if (tag.id) {
        const res = await fetch(`/api/lectures/tags/${tag.id}`, { method: 'DELETE' });
        if (!res.ok) { const err = await res.json(); alert(err.error ?? '태그 삭제에 실패했습니다.'); return; }
      }
      setList((p) => p.filter((t) => t.label !== tag.label));
    };

  const selectedLec = lectures.find((l) => l.id === selectedId) ?? null;

  // 태그 토글 버튼 렌더
  const TagToggle = ({
    tags, active, onToggle,
  }: {
    tags: Tag[];
    active: string[];
    onToggle: (label: string) => void;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const on = active.includes(t.label);
        return (
          <button
            key={t.id ?? t.label}
            onClick={() => onToggle(t.label)}
            className="px-3 py-1 rounded-full text-[12px] border-[1.5px] transition-all font-medium"
            style={on
              ? { background: t.bg, color: t.color, borderColor: t.border ?? t.color }
              : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e2e8f0' }}
          >
            {on && <span className="mr-1 text-[10px]">✓</span>}
            {t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      {/* 왼쪽: 강의 선택 패널 */}
      <div className="w-[220px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-[#f1f5f9] text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">강의 선택</div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
          ) : lectures.length === 0 ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 강의 없음</p>
          ) : (
            lectures.map((lec) => {
              const active = selectedId === lec.id;
              return (
                <div
                  key={lec.id}
                  onClick={() => selectLecture(lec)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#f1f5f9] cursor-pointer hover:bg-gray-50 last:border-none transition-colors"
                  style={active ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 11 } : {}}
                >
                  <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                    <span style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '9px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#111827] truncate">{lec.title}</p>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {lectureTags(lec).slice(0, 3).map((t) => (
                        <span key={t.label} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 오른쪽: 태그 편집 */}
      <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto">
        {/* 선택 강의 태그 설정 */}
        <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
            <div>
              <span className="text-[13px] font-semibold text-[#1a2535]">
                {selectedLec ? `${selectedLec.title}` : '강의를 선택하세요'}
              </span>
              {selectedLec && <span className="ml-2 text-[11.5px] text-[#9ca3af]">— 태그 설정</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTagModal(true)}
                className="px-3 py-1 rounded-[7px] text-[12px] font-medium border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-gray-50"
              >
                태그 관리
              </button>
              {selectedLec && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60 transition-colors"
                  style={{ background: saved ? '#059669' : '#5B4FBE' }}
                >
                  {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
                </button>
              )}
            </div>
          </div>
          {!selectedLec ? (
            <p className="text-[12.5px] text-[#9ca3af] text-center py-8">왼쪽에서 강의를 클릭하세요</p>
          ) : (
            <div className="px-4 py-3.5 flex flex-col gap-4">
              <div>
                <p className="text-[11.5px] font-semibold text-[#6b7280] mb-2">과목</p>
                <TagToggle
                  tags={subjects}
                  active={editSubjects}
                  onToggle={(label) => toggle(editSubjects, setEditSubjects, label)}
                />
              </div>
              <div>
                <p className="text-[11.5px] font-semibold text-[#6b7280] mb-2">레벨</p>
                <TagToggle
                  tags={levels}
                  active={editLevels}
                  onToggle={(label) => toggle(editLevels, setEditLevels, label)}
                />
              </div>
              <div>
                <p className="text-[11.5px] font-semibold text-[#6b7280] mb-2">대상 학년</p>
                <TagToggle
                  tags={grades}
                  active={editGrades}
                  onToggle={(label) => toggle(editGrades, setEditGrades, label)}
                />
              </div>
              <div>
                <p className="text-[11.5px] font-semibold text-[#6b7280] mb-2">기타</p>
                {etcs.length === 0 ? (
                  <p className="text-[11.5px] text-[#9ca3af] italic">우측 상단 <strong>태그 관리</strong>에서 기타 태그를 먼저 추가하세요</p>
                ) : (
                  <TagToggle
                    tags={etcs}
                    active={editEtcs}
                    onToggle={(label) => toggle(editEtcs, setEditEtcs, label)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 태그 관리 모달 */}
      {showTagModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => e.target === e.currentTarget && setShowTagModal(false)}
        >
          <div className="bg-white rounded-[14px] shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between shrink-0">
              <div>
                <p className="text-[14px] font-bold text-[#1a2535]">커스텀 태그 관리</p>
                <p className="text-[11.5px] text-[#9ca3af] mt-0.5">
                  기본 태그는 모든 학원 공통 · <span style={{ color: CUSTOM_STYLE.color }}>보라색 태그</span>는 이 학원에서 추가한 태그
                </p>
              </div>
              <button
                onClick={() => setShowTagModal(false)}
                className="text-[#9ca3af] hover:text-[#374151] text-[22px] leading-none ml-4"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-3">
              <TagGroup title="과목 태그" tags={subjects} onDelete={makeDeleter(setSubjects)} onAdd={makeAdder('subject', subjects, setSubjects)} inputPlaceholder="새 과목 입력 (예: 사회)" />
              <TagGroup title="레벨 태그" tags={levels} onDelete={makeDeleter(setLevels)} onAdd={makeAdder('level', levels, setLevels)} inputPlaceholder="새 레벨 입력 (예: 최고급)" />
              <TagGroup title="대상 학년 태그" tags={grades} onDelete={makeDeleter(setGrades)} onAdd={makeAdder('grade', grades, setGrades)} inputPlaceholder="새 학년 입력 (예: 중2)" />
              <TagGroup title="기타 태그 (학원 전용)" tags={etcs} onDelete={makeDeleter(setEtcs)} onAdd={makeAdder('etc', etcs, setEtcs)} inputPlaceholder="새 기타 태그 입력 (예: 특강)" />
            </div>
            <div className="px-5 py-3.5 border-t border-[#e2e8f0] flex justify-end shrink-0">
              <button
                onClick={() => setShowTagModal(false)}
                className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-white"
                style={{ background: '#5B4FBE' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: 수강 대상 지정 ──────────────────────────────────────
type TargetStudent = { id: string; name: string; grade: number; classIds: string[] };
type TargetClass   = { id: string; name: string; count: number };

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

// 강의 선택 트리 패널 (시리즈 ▸ 강의)
function TargetTreePanel({
  lectures, seriesList, loading, mode, onModeChange,
  selectedLecId, selectedSeriesId, onSelectLecture, onSelectSeries,
}: {
  lectures: Lecture[];
  seriesList: Series[];
  loading: boolean;
  mode: 'lecture' | 'series';
  onModeChange: (m: 'lecture' | 'series') => void;
  selectedLecId: string;
  selectedSeriesId: string;
  onSelectLecture: (id: string) => void;
  onSelectSeries: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const episodesOf = (sid: string) =>
    lectures
      .filter((l) => l.seriesId === sid)
      .sort((a, b) => (a.episodeNumber ?? a.orderIndex) - (b.episodeNumber ?? b.orderIndex));
  const standalone = lectures.filter((l) => !l.seriesId);

  return (
    <div className="w-[260px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex flex-col">
      {/* 헤더 + 시리즈별/강의별 모드 토글 */}
      <div className="px-3 py-2.5 border-b border-[#f1f5f9] flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">강의 선택</span>
        <div className="flex rounded-[7px] overflow-hidden border border-[#e2e8f0] text-[10.5px] font-semibold shrink-0">
          {(['series', 'lecture'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className="px-2 py-1 transition-colors"
              style={mode === m
                ? { background: '#5B4FBE', color: '#fff' }
                : { background: '#fff', color: '#6b7280' }}
            >
              {m === 'series' ? '시리즈별' : '강의별'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
        ) : seriesList.length === 0 && lectures.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 강의가 없습니다</p>
        ) : (
          <>
            {seriesList.map((series) => {
              const eps    = episodesOf(series.id);
              const empty  = eps.length === 0;
              const isOpen = !collapsed.has(series.id);
              const seriesSelectable = mode === 'series' && !empty;
              const seriesSelected   = mode === 'series' && selectedSeriesId === series.id;
              return (
                <div key={series.id} className="border-b border-[#f1f5f9] last:border-none">
                  {/* 시리즈 헤더 */}
                  <div
                    onClick={() => { if (seriesSelectable) onSelectSeries(series.id); }}
                    className="flex items-center gap-2 px-2.5 py-2.5 transition-colors"
                    style={{
                      ...(seriesSelected ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 7 } : {}),
                      cursor: seriesSelectable ? 'pointer' : (mode === 'series' ? 'not-allowed' : 'default'),
                      opacity: mode === 'series' && empty ? 0.5 : 1,
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggle(series.id); }}
                      className="w-4 text-[10px] text-[#9ca3af] shrink-0 hover:text-[#374151]"
                    >
                      {isOpen ? '▾' : '▸'}
                    </button>
                    <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                      <span style={{ borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold truncate" style={{ color: seriesSelected ? '#534AB7' : '#111827' }}>{series.title}</p>
                      <p className="text-[10px] text-[#9ca3af]">{empty ? '강의 없음' : `시리즈 · 총 ${eps.length}강`}</p>
                    </div>
                    {seriesSelectable && (
                      <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: '#EEEDFE', color: '#534AB7' }}>시리즈</span>
                    )}
                  </div>
                  {/* 에피소드 목록 */}
                  {isOpen && (
                    <div className="bg-[#fafafa]">
                      {empty ? (
                        <p className="pl-9 pr-3 py-2 text-[11px] text-[#9ca3af] italic">비어 있는 시리즈입니다</p>
                      ) : (
                        eps.map((ep, idx) => {
                          const lecSelectable = mode === 'lecture';
                          const lecSelected   = mode === 'lecture' && selectedLecId === ep.id;
                          return (
                            <div
                              key={ep.id}
                              onClick={() => { if (lecSelectable) onSelectLecture(ep.id); }}
                              className="flex items-center gap-2 pl-9 pr-3 py-2 border-t border-[#f1f5f9] transition-colors"
                              style={{
                                ...(lecSelected ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 33 } : {}),
                                cursor: lecSelectable ? 'pointer' : 'default',
                                opacity: mode === 'series' && !seriesSelected ? 0.55 : 1,
                              }}
                            >
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9.5px] font-bold shrink-0" style={{ background: '#EEEDFE', color: '#534AB7' }}>
                                {ep.episodeNumber ?? idx + 1}
                              </span>
                              <p className="text-[11.5px] font-medium truncate" style={{ color: lecSelected ? '#534AB7' : '#374151' }}>{ep.title}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 시리즈 미지정 강의 */}
            {standalone.length > 0 && (
              <div className="border-b border-[#f1f5f9] last:border-none">
                <div className="px-2.5 py-2 bg-[#f9fafb]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">시리즈 미지정</p>
                </div>
                {standalone.map((lec) => {
                  const lecSelectable = mode === 'lecture';
                  const lecSelected   = mode === 'lecture' && selectedLecId === lec.id;
                  return (
                    <div
                      key={lec.id}
                      onClick={() => { if (lecSelectable) onSelectLecture(lec.id); }}
                      className="flex items-center gap-2 px-2.5 py-2.5 border-t border-[#f1f5f9] transition-colors"
                      style={{
                        ...(lecSelected ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 7 } : {}),
                        cursor: lecSelectable ? 'pointer' : 'default',
                        opacity: mode === 'series' ? 0.55 : 1,
                      }}
                    >
                      <div className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                        <span style={{ borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                      </div>
                      <p className="text-[12px] font-semibold truncate" style={{ color: lecSelected ? '#534AB7' : '#111827' }}>{lec.title}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[#f1f5f9] text-[10.5px] text-[#9ca3af] leading-snug">
        {mode === 'series'
          ? '시리즈를 선택하면 소속 강의 전체에 동일한 수강 대상이 적용됩니다.'
          : '강의별로 수강 대상을 개별 지정합니다.'}
      </div>
    </div>
  );
}

// 수강 대상 편집 — 강의 1개(강의별) 또는 시리즈 소속 강의 N개(시리즈별)에 일괄 적용
function TargetEditor({
  mode, title, lectureIds, students, classes, dataLoading,
}: {
  mode: 'lecture' | 'series';
  title: string;
  lectureIds: string[];
  students: TargetStudent[];
  classes: TargetClass[];
  dataLoading: boolean;
}) {
  const [targetType,      setTargetType]      = useState<'class' | 'individual' | 'all'>('class');
  const [checkedClass,    setCheckedClass]    = useState<string[]>([]);
  const [checkedStudents, setCheckedStudents] = useState<string[]>([]);
  const [search,          setSearch]          = useState('');
  const [targetsLoading,  setTargetsLoading]  = useState(false);
  const [mixed,           setMixed]           = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  const idsKey  = lectureIds.join(',');
  const isSeries = mode === 'series';

  // 대상 강의들의 기존 수강 대상 로드 — 시리즈는 강의별로 다를 수 있어 일치 여부 검사
  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split(',');
    let alive = true;
    setTargetsLoading(true);
    setSaved(false);
    setMixed(false);
    setSearch('');
    Promise.all(
      ids.map((id) => fetch(`/api/lectures/${id}/targets`).then((r) => r.json())),
    )
      .then((results) => {
        if (!alive) return;
        const norm = results.map((d) => ({
          type: d.targetMode === 'INDIVIDUAL' ? 'individual' : d.targetMode === 'ALL' ? 'all' : 'class',
          classIds:   Array.isArray(d.classIds)   ? d.classIds   : [],
          studentIds: Array.isArray(d.studentIds) ? d.studentIds : [],
        }));
        const first = norm[0] ?? { type: 'class', classIds: [], studentIds: [] };
        const uniform = norm.every((n) =>
          n.type === first.type &&
          sameSet(n.classIds, first.classIds) &&
          sameSet(n.studentIds, first.studentIds),
        );
        setMixed(!uniform);
        setTargetType(first.type as 'class' | 'individual' | 'all');
        setCheckedClass(first.classIds);
        setCheckedStudents(first.studentIds);
      })
      .catch(() => {})
      .finally(() => { if (alive) setTargetsLoading(false); });
    return () => { alive = false; };
  }, [idsKey]);

  const handleSave = async () => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        targetMode: targetType === 'individual' ? 'INDIVIDUAL' : targetType === 'all' ? 'ALL' : 'CLASS',
        classIds: checkedClass,
        studentIds: checkedStudents,
      });
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/lectures/${id}/targets`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body,
          }),
        ),
      );
      if (results.some((r) => !r.ok)) throw new Error();
      setSaved(true);
      setMixed(false);
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const classNameById = useMemo(() => {
    const m: Record<string, string> = {};
    classes.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [classes]);

  const studentClassNames = (s: TargetStudent) =>
    s.classIds.map((id) => classNameById[id]).filter(Boolean);

  // 이름 또는 반 이름으로 검색
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.classIds.some((id) => (classNameById[id] ?? '').toLowerCase().includes(q)),
    );
  }, [students, search, classNameById]);

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-[#1a2535]">{title} — 수강 대상</span>
          {isSeries && (
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EEEDFE', color: '#534AB7' }}>
              시리즈 전체 {lectureIds.length}강 일괄 적용
            </span>
          )}
        </div>

        {isSeries && mixed && !targetsLoading && (
          <div className="px-4 py-2.5 text-[11.5px] border-b border-[#f1f5f9]" style={{ background: '#FEF9C3', color: '#854d0e' }}>
            ⚠ 이 시리즈의 강의들이 서로 다른 수강 대상으로 지정되어 있습니다. 저장하면 아래 설정으로 전체 통일됩니다.
          </div>
        )}

        <div className="flex gap-2 px-4 py-3 border-b border-[#f1f5f9]">
          {(['class','individual','all'] as const).map((t) => (
            <button key={t} onClick={() => { setTargetType(t); setSaved(false); }}
              className="px-4 py-1.5 rounded-[8px] text-[12.5px] font-medium border-[1.5px] transition-all"
              style={targetType === t
                ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' }
                : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}>
              {t === 'class' ? '반 단위 지정' : t === 'individual' ? '개별 학생 지정' : '전체 공개'}
            </button>
          ))}
        </div>
        {/* 반 단위 지정 */}
        {targetType === 'class' && (
          dataLoading ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-10">반 목록을 불러오는 중...</p>
          ) : classes.length === 0 ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-10">등록된 반이 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-4">
              {classes.map((c) => {
                const checked = checkedClass.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => { setCheckedClass((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]); setSaved(false); }}
                    className="flex items-center gap-2 px-3 py-2.5 border-[1.5px] rounded-[8px] cursor-pointer"
                    style={checked ? { background: '#EEEDFE', borderColor: '#a78bfa' } : { borderColor: '#e2e8f0' }}
                  >
                    <div className="rounded flex items-center justify-center text-[10px] shrink-0"
                      style={checked ? { background: '#a78bfa', border: '1.5px solid #a78bfa', color: '#fff', width: 17, height: 17 } : { border: '1.5px solid #e2e8f0', width: 17, height: 17 }}>
                      {checked ? '✓' : ''}
                    </div>
                    <div>
                      <p className="text-[12.5px] font-semibold" style={checked ? { color: '#534AB7' } : { color: '#111827' }}>{c.name}</p>
                      <p className="text-[10.5px] text-[#9ca3af]">{c.count}명</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* 개별 학생 지정 */}
        {targetType === 'individual' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[12px] text-[#9ca3af]">수강할 학생을 개별로 선택합니다.</p>
              {!dataLoading && students.length > 0 && (
                <p className="text-[11.5px] text-[#9ca3af]">
                  전체 {students.length}명{search.trim() && ` · 검색결과 ${filteredStudents.length}명`}
                </p>
              )}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="학생 이름 또는 반 이름으로 검색"
              className="w-full text-[12.5px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white mb-3"
            />
            {dataLoading ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-8">학생 목록을 불러오는 중...</p>
            ) : students.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-8">학원에 등록된 학생이 없습니다</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-8">검색 결과가 없습니다</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredStudents.map((s) => {
                  const checked  = checkedStudents.includes(s.id);
                  const clsNames = studentClassNames(s);
                  return (
                    <div
                      key={s.id}
                      onClick={() => { setCheckedStudents((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]); setSaved(false); }}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 border-[1.5px] rounded-[8px] cursor-pointer transition-colors"
                      style={checked ? { background: '#EEEDFE', borderColor: '#a78bfa' } : { borderColor: '#e2e8f0' }}
                    >
                      <div className="rounded flex items-center justify-center text-[10px] shrink-0"
                        style={checked ? { background: '#a78bfa', border: '1.5px solid #a78bfa', color: '#fff', width: 17, height: 17 } : { border: '1.5px solid #e2e8f0', width: 17, height: 17 }}>
                        {checked ? '✓' : ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold" style={checked ? { color: '#534AB7' } : { color: '#111827' }}>{s.name}</p>
                        <p className="text-[10.5px] text-[#9ca3af] truncate">{clsNames.length > 0 ? clsNames.join(', ') : '미배정'}</p>
                      </div>
                      <span className="text-[11px] text-[#9ca3af] shrink-0">{gradeLabel(s.grade)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 전체 공개 */}
        {targetType === 'all' && (
          <div className="p-5 flex flex-col items-center justify-center gap-3 py-10">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-[22px]" style={{ background: '#EEEDFE' }}>🌐</div>
            <p className="text-[14px] font-semibold text-[#1a2535]">전체 공개</p>
            <p className="text-[12.5px] text-[#6b7280] text-center max-w-[320px] leading-relaxed">
              {isSeries ? '이 시리즈의 모든 강의' : '이 강의'}는 학원에 등록된 <strong>모든 학생</strong>에게 공개됩니다.<br />
              특정 반 또는 학생만 접근하게 하려면 다른 옵션을 선택하세요.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#6b7280] leading-7">
        {targetType === 'all' && (
          <>현재 수강 대상: <strong style={{ color: '#534AB7' }}>전체 공개</strong> — 학원의 모든 학생이 {isSeries ? '이 시리즈 강의를' : '이 강의를'} 볼 수 있습니다.</>
        )}
        {targetType === 'class' && (
          <>
            현재 수강 대상: <strong style={{ color: '#534AB7' }}>{checkedClass.length > 0 ? classes.filter((c) => checkedClass.includes(c.id)).map((c) => c.name).join(', ') : '미지정'}</strong>
            {checkedClass.length > 0 && <> — 총 {classes.filter((c) => checkedClass.includes(c.id)).reduce((a, c) => a + c.count, 0)}명</>}
            <br />대상 변경 시 즉시 적용되며, 새로 추가된 학생에게는 강의가 표시됩니다.
          </>
        )}
        {targetType === 'individual' && (
          <>
            현재 수강 대상: <strong style={{ color: '#534AB7' }}>{checkedStudents.length > 0 ? `${checkedStudents.length}명 선택됨` : '미지정'}</strong>
            {checkedStudents.length > 0 && <> — {students.filter((s) => checkedStudents.includes(s.id)).map((s) => s.name).join(', ')}</>}
            <br />선택된 학생에게만 강의가 표시됩니다.
          </>
        )}
      </div>

      {/* 저장 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || targetsLoading || dataLoading}
          className="px-4 py-2 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60 transition-colors"
          style={{ background: saved ? '#059669' : '#5B4FBE' }}
        >
          {saving ? '저장 중...' : saved ? '✓ 저장됨' : (isSeries ? `시리즈 전체 저장 (${lectureIds.length}강)` : '저장')}
        </button>
      </div>
    </div>
  );
}

function TargetContent({ lectures, loading }: { lectures: Lecture[]; loading: boolean }) {
  const [seriesList,    setSeriesList]    = useState<Series[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [mode,             setMode]             = useState<'lecture' | 'series'>('lecture');
  const [selectedLecId,    setSelectedLecId]    = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');

  // 학원 전체 학생·반 — DB 연동
  const [students,    setStudents]    = useState<TargetStudent[]>([]);
  const [classes,     setClasses]     = useState<TargetClass[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/lecture-series')
      .then((r) => r.json())
      .then((d) => { if (alive) setSeriesList(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => { if (alive) setSeriesLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setDataLoading(true);
    Promise.all([
      fetch('/api/students').then((r) => r.json()),
      fetch('/api/classes').then((r) => r.json()),
    ])
      .then(([studentData, classData]) => {
        if (!alive) return;
        setClasses(
          Array.isArray(classData)
            ? classData.map((c: { id: string; name: string; currentStudents: number }) => ({
                id: c.id, name: c.name, count: c.currentStudents ?? 0,
              }))
            : [],
        );
        setStudents(
          Array.isArray(studentData)
            ? studentData.map((s: { id: string; name: string; grade: number; classes: string[] }) => ({
                id: s.id, name: s.name, grade: s.grade, classIds: s.classes ?? [],
              }))
            : [],
        );
      })
      .catch(() => { if (alive) { setClasses([]); setStudents([]); } })
      .finally(() => { if (alive) setDataLoading(false); });
    return () => { alive = false; };
  }, []);

  const episodesOf = (sid: string) =>
    lectures
      .filter((l) => l.seriesId === sid)
      .sort((a, b) => (a.episodeNumber ?? a.orderIndex) - (b.episodeNumber ?? b.orderIndex));

  // 모드별 기본 선택
  useEffect(() => {
    if (mode === 'lecture' && !selectedLecId && lectures.length > 0) {
      setSelectedLecId(lectures[0].id);
    }
  }, [mode, lectures, selectedLecId]);

  useEffect(() => {
    if (mode === 'series' && !selectedSeriesId && seriesList.length > 0) {
      const firstNonEmpty = seriesList.find((s) => lectures.some((l) => l.seriesId === s.id));
      if (firstNonEmpty) setSelectedSeriesId(firstNonEmpty.id);
    }
  }, [mode, seriesList, lectures, selectedSeriesId]);

  const selectedLec    = lectures.find((l) => l.id === selectedLecId) ?? null;
  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId) ?? null;
  const seriesEpisodes = selectedSeries ? episodesOf(selectedSeries.id) : [];

  const editorIds = mode === 'lecture'
    ? (selectedLec ? [selectedLec.id] : [])
    : seriesEpisodes.map((l) => l.id);
  const editorTitle = mode === 'lecture'
    ? (selectedLec?.title ?? '')
    : (selectedSeries?.title ?? '');

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      <TargetTreePanel
        lectures={lectures}
        seriesList={seriesList}
        loading={loading || seriesLoading}
        mode={mode}
        onModeChange={setMode}
        selectedLecId={selectedLecId}
        selectedSeriesId={selectedSeriesId}
        onSelectLecture={setSelectedLecId}
        onSelectSeries={setSelectedSeriesId}
      />
      {editorIds.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af] bg-white border border-[#e2e8f0] rounded-[10px]">
          {mode === 'series'
            ? (seriesList.length === 0 ? '등록된 시리즈가 없습니다' : '강의가 등록된 시리즈를 선택해주세요')
            : '강의를 선택해주세요'}
        </div>
      ) : (
        <TargetEditor
          mode={mode}
          title={editorTitle}
          lectureIds={editorIds}
          students={students}
          classes={classes}
          dataLoading={dataLoading}
        />
      )}
    </div>
  );
}

// ─── Tab: 이수 조건 설정 ──────────────────────────────────────
const COND_DEFAULTS = { passScore: 70, maxTries: 3, examCond: 'after100' as const };

function CondContent({ selectedLec }: { selectedLec: Lecture | null }) {
  const [passScore, setPassScore] = useState(COND_DEFAULTS.passScore);
  const [maxTries,  setMaxTries]  = useState(COND_DEFAULTS.maxTries);
  const [examCond,  setExamCond]  = useState<'after100' | 'anytime'>(COND_DEFAULTS.examCond);

  const [condLoading, setCondLoading] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  // 선택 강의의 기존 이수 조건 로드
  const lecId = selectedLec?.id;
  useEffect(() => {
    if (!lecId) return;
    let alive = true;
    setCondLoading(true);
    setSaved(false);
    fetch(`/api/ingang/quizzes/${lecId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setPassScore(d?.passScore ?? COND_DEFAULTS.passScore);
        setMaxTries(d?.maxTries ?? COND_DEFAULTS.maxTries);
        setExamCond(d?.examCond === 'anytime' ? 'anytime' : 'after100');
      })
      .catch(() => {})
      .finally(() => { if (alive) setCondLoading(false); });
    return () => { alive = false; };
  }, [lecId]);

  const handleReset = () => {
    setPassScore(COND_DEFAULTS.passScore);
    setMaxTries(COND_DEFAULTS.maxTries);
    setExamCond(COND_DEFAULTS.examCond);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedLec) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ingang/quizzes/${selectedLec.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passScore, maxTries, examCond }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedLec) return <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">강의를 선택해주세요</div>;

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] p-4">
        <p className="text-[13px] font-semibold text-[#1a2535] mb-4">{selectedLec.title} — 이수 조건</p>
        <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
          시험 합격 기준:
          <input type="number" value={passScore} onChange={(e) => { setPassScore(+e.target.value); setSaved(false); }}
            className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]" />
          점 이상
        </div>
        <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
          최대 응시 횟수:
          <input type="number" value={maxTries} onChange={(e) => { setMaxTries(+e.target.value); setSaved(false); }}
            className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]" />
          회
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <span className="text-[13px] text-[#374151]">시험 응시 조건:</span>
          <div className="flex gap-2">
            {(['after100','anytime'] as const).map((c) => (
              <button key={c} onClick={() => { setExamCond(c); setSaved(false); }}
                className="text-[12px] px-3 py-1.5 rounded-[8px] border-[1.5px] font-medium"
                style={examCond === c ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' } : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}>
                {c === 'after100' ? '영상 100% 시청 후 응시 가능' : '바로 응시 가능'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-[#9ca3af] bg-[#f9fafb] rounded-[8px] px-3 py-2.5 leading-relaxed">
          합격 기준 {passScore}점 이상, 최대 {maxTries}회 응시 가능합니다. {maxTries}회 모두 불합격 시 원장/강사의 재응시 허용이 필요합니다.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={handleReset}
          disabled={saving || condLoading}
          className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          초기화
        </button>
        <button
          onClick={handleSave}
          disabled={saving || condLoading}
          className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60 transition-colors"
          style={{ background: saved ? '#059669' : '#5B4FBE' }}
        >
          {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: 시험 출제 ───────────────────────────────────────────
function ExamContent({ lectures, loading }: { lectures: Lecture[]; loading: boolean }) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [quiz,       setQuiz]       = useState<QuizData>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [saving,     setSaving]     = useState(false);

  // 강의 목록이 로드되면 첫 번째 강의 선택
  useEffect(() => {
    if (lectures.length > 0 && !selectedId) setSelectedId(lectures[0].id);
  }, [lectures, selectedId]);

  // 강의 선택 시 해당 퀴즈 로드
  useEffect(() => {
    if (!selectedId) return;
    setQuizLoading(true);
    fetch(`/api/ingang/quizzes/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data) {
          setQuiz({ passScore: 70, maxTries: 3, examCond: 'after100', questions: [] });
        } else {
          // DB 필드명 → 내부 타입으로 매핑
          setQuiz({
            passScore: data.passScore,
            maxTries:  data.maxTries,
            examCond:  data.examCond,
            questions: (data.questions ?? []).map((q: { text: string; score: number; options: { text: string; isCorrect: boolean }[] }) => ({
              text:    q.text,
              score:   q.score,
              options: q.options.map((o: { text: string; isCorrect: boolean }) => ({ text: o.text, isCorrect: o.isCorrect })),
            })),
          });
        }
      })
      .catch(() => setQuiz({ passScore: 70, maxTries: 3, examCond: 'after100', questions: [] }))
      .finally(() => setQuizLoading(false));
  }, [selectedId]);

  const setQ = (qi: number, fn: (q: QuizQuestion) => QuizQuestion) =>
    setQuiz((prev) => prev ? { ...prev, questions: prev.questions.map((q, i) => (i === qi ? fn(q) : q)) } : prev);

  const setOpt = (qi: number, oi: number, fn: (o: QuizOption) => QuizOption) =>
    setQ(qi, (q) => ({ ...q, options: q.options.map((o, i) => (i === oi ? fn(o) : o)) }));

  const markCorrect = (qi: number, oi: number) =>
    setQ(qi, (q) => ({ ...q, options: q.options.map((o, i) => ({ ...o, isCorrect: i === oi })) }));

  const addQuestion = () =>
    setQuiz((prev) => prev ? {
      ...prev,
      questions: [...prev.questions, {
        text: '', score: 20,
        options: [
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
        ],
      }],
    } : prev);

  const deleteQ = (qi: number) =>
    setQuiz((prev) => prev ? { ...prev, questions: prev.questions.filter((_, i) => i !== qi) } : prev);

  const handleSave = async () => {
    if (!selectedId || !quiz) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ingang/quizzes/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quiz),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setQuiz({
        passScore: saved.passScore,
        maxTries:  saved.maxTries,
        examCond:  saved.examCond,
        questions: (saved.questions ?? []).map((q: { text: string; score: number; options: { text: string; isCorrect: boolean }[] }) => ({
          text: q.text, score: q.score,
          options: q.options.map((o: { text: string; isCorrect: boolean }) => ({ text: o.text, isCorrect: o.isCorrect })),
        })),
      });
      alert('저장 완료!');
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const selectedLec = lectures.find((l) => l.id === selectedId);
  const questions   = quiz?.questions ?? [];

  return (
    <div className="flex-1 overflow-hidden flex gap-4">
      {/* Left: lecture list */}
      <div className="w-[220px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-[#f1f5f9] text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">강의 목록</div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
          ) : lectures.length === 0 ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-6">등록된 강의가 없습니다</p>
          ) : (
            lectures.map((l) => (
              <div
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className="px-3.5 py-2.5 border-b border-[#f1f5f9] cursor-pointer hover:bg-gray-50 last:border-none"
                style={selectedId === l.id ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 11 } : {}}
              >
                <p className="text-[12.5px] font-semibold text-[#111827] truncate">{l.title}</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">{[...l.subjects, ...l.levels].join(' · ') || '—'}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: exam editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f6f8] rounded-[10px]">
        {quizLoading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">불러오는 중...</div>
        ) : !selectedLec ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">강의를 선택해주세요</div>
        ) : (
          <>
            <div className="px-4 py-3 bg-white border-b border-[#e2e8f0] flex items-center justify-between shrink-0 rounded-t-[10px]">
              <span className="text-[13px] font-semibold text-[#1a2535]">{selectedLec.title} — 시험 출제</span>
              <div className="flex items-center gap-3 text-[12px] text-[#6b7280]">
                <span>총 {questions.length}문제</span>
                <span className="flex items-center gap-1.5">
                  합격 기준
                  <input
                    type="number" value={quiz?.passScore ?? 70}
                    onChange={(e) => setQuiz((p) => p ? { ...p, passScore: +e.target.value } : p)}
                    className="w-14 text-center text-[12.5px] px-2 py-1 border border-[#e2e8f0] rounded-[6px] bg-[#f9fafb] outline-none"
                  />
                  점 이상
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5">
              {questions.map((q, qi) => (
                <div key={qi} className="bg-white border border-[#e2e8f0] rounded-[10px] p-4 mb-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[12px] font-bold" style={{ background: '#EEEDFE', color: '#a78bfa' }}>{qi + 1}번</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#6b7280] flex items-center gap-1.5">
                        배점
                        <input
                          type="number" value={q.score}
                          onChange={(e) => setQ(qi, (x) => ({ ...x, score: +e.target.value }))}
                          className="w-10 text-center text-[12px] px-1.5 py-0.5 border border-[#e2e8f0] rounded bg-[#f9fafb] outline-none"
                        />
                      </span>
                      <button onClick={() => deleteQ(qi)} className="text-[12px] text-[#f87171] cursor-pointer">삭제</button>
                    </div>
                  </div>
                  <input
                    type="text" value={q.text}
                    onChange={(e) => setQ(qi, (x) => ({ ...x, text: e.target.value }))}
                    className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white mb-2.5 font-semibold text-[#111827]"
                    placeholder="문제를 입력하세요"
                  />
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <div
                          onClick={() => markCorrect(qi, oi)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold cursor-pointer shrink-0 transition-all select-none"
                          style={opt.isCorrect ? { background: '#a78bfa', color: '#fff' } : { background: '#f1f5f9', color: '#6b7280' }}
                        >
                          {NUMS[oi]}
                        </div>
                        <input
                          type="text" value={opt.text}
                          onChange={(e) => setOpt(qi, oi, (o) => ({ ...o, text: e.target.value }))}
                          className="flex-1 text-[12.5px] px-2.5 py-1.5 border rounded-[7px] bg-[#f9fafb] outline-none focus:bg-white"
                          style={opt.isCorrect ? { borderColor: '#a78bfa', background: '#EEEDFE' } : { borderColor: '#e2e8f0' }}
                          placeholder={`보기 ${oi + 1}`}
                        />
                        {opt.isCorrect && <span className="text-[11px] font-semibold text-[#a78bfa] shrink-0">정답</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={addQuestion}
                className="w-full border-[1.5px] border-dashed border-[#e2e8f0] rounded-[10px] py-3.5 text-[13px] text-[#9ca3af] font-medium hover:border-[#a78bfa] hover:text-[#a78bfa] transition-colors"
              >
                + 문제 추가
              </button>
            </div>
            <div className="px-4 py-3 bg-white border-t border-[#e2e8f0] flex justify-end gap-2 shrink-0 rounded-b-[10px]">
              <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">임시저장</button>
              <button
                onClick={handleSave} disabled={saving}
                className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60"
                style={{ background: '#5B4FBE' }}
              >
                {saving ? '저장 중...' : '저장 완료'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab: 재응시 관리 ─────────────────────────────────────────
function RetryContent() {
  const [pending,  setPending]  = useState<RetryPending[]>([]);
  const [history,  setHistory]  = useState<RetryHistory[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [allowing, setAllowing] = useState<string | null>(null); // quizId+studentId key

  const load = () => {
    setLoading(true);
    fetch('/api/ingang/retry')
      .then((r) => r.json())
      .then((data) => {
        setPending(Array.isArray(data.pending) ? data.pending : []);
        setHistory(Array.isArray(data.history) ? data.history : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAllow = async (quizId: string, studentId: string) => {
    const key = `${quizId}:${studentId}`;
    setAllowing(key);
    try {
      const res = await fetch('/api/ingang/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, studentId }),
      });
      if (!res.ok) throw new Error();
      load();
    } catch {
      alert('재응시 허용에 실패했습니다.');
    } finally {
      setAllowing(null);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">불러오는 중...</div>;
  }

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535] flex items-center justify-between">
          재응시 요청 목록
          <span className="text-[12px] font-normal text-[#9ca3af]">최대 응시 횟수 초과 학생</span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['학생명','강의명','응시 횟수','최고 점수','상태','관리'].map((h) => (
                <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-[12.5px] text-[#9ca3af]">재응시 요청이 없습니다</td></tr>
            ) : pending.map((r) => {
              const key = `${r.quizId}:${r.studentId}`;
              return (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#111827] border-b border-[#f1f5f9]">{r.student}</td>
                  <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lectureTitle}</td>
                  <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#991b1b] border-b border-[#f1f5f9]">{r.tries}/{r.maxTries}회</td>
                  <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#991b1b] border-b border-[#f1f5f9]">{r.bestScore}점</td>
                  <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#FEE2E2', color: '#991b1b' }}>초과</span>
                  </td>
                  <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                    <button
                      onClick={() => handleAllow(r.quizId, r.studentId)}
                      disabled={allowing === key}
                      className="px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium text-white disabled:opacity-60"
                      style={{ background: '#5B4FBE' }}
                    >
                      {allowing === key ? '처리 중...' : '재응시 1회 허용'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">재응시 허용 이력</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['학생명','강의명','허용 일시','허용자','결과'].map((h) => (
                <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-[12.5px] text-[#9ca3af]">이력이 없습니다</td></tr>
            ) : history.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#111827] border-b border-[#f1f5f9]">{r.student}</td>
                <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lectureTitle}</td>
                <td className="py-2.5 px-3.5 text-[11.5px] text-[#6b7280] border-b border-[#f1f5f9]">
                  {new Date(r.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '.').replace('.', '')}
                </td>
                <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.allowedBy}</td>
                <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={r.passed ? { background: '#D1FAE5', color: '#065f46' } : { background: '#f1f5f9', color: '#6b7280' }}>
                    {r.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: 시리즈 구성 ──────────────────────────────────────────
function SeriesContent({ lectures, loading, onLecturesChange }: {
  lectures: Lecture[];
  loading: boolean;
  onLecturesChange: React.Dispatch<React.SetStateAction<Lecture[]>>;
}) {
  const [seriesList,    setSeriesList]    = useState<Series[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [selectedId,    setSelectedId]    = useState('');
  const [adding,        setAdding]        = useState(false);
  const [newTitle,      setNewTitle]      = useState('');
  const [creating,      setCreating]      = useState(false);
  const [search,        setSearch]        = useState('');
  const [busy,          setBusy]          = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/lecture-series')
      .then((r) => r.json())
      .then((d) => { if (alive) setSeriesList(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => { if (alive) setSeriesLoading(false); });
    return () => { alive = false; };
  }, []);

  const episodesOf = (sid: string) =>
    lectures
      .filter((l) => l.seriesId === sid)
      .sort((a, b) => (a.episodeNumber ?? a.orderIndex) - (b.episodeNumber ?? b.orderIndex));

  useEffect(() => {
    if (!selectedId && seriesList.length > 0) setSelectedId(seriesList[0].id);
  }, [seriesList, selectedId]);

  const selectedSeries = seriesList.find((s) => s.id === selectedId) ?? null;
  const episodes = selectedSeries ? episodesOf(selectedSeries.id) : [];

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/lecture-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, orderIndex: seriesList.length }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setSeriesList((prev) => [...prev, { id: created.id, title: created.title, orderIndex: created.orderIndex, status: created.status }]);
      setSelectedId(created.id);
      setNewTitle('');
      setAdding(false);
    } catch {
      alert('시리즈 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  // 시리즈 내 강의 순서를 표시 순서(1..N)대로 정규화
  const applyOrder = async (ordered: Lecture[]) => {
    const changed = ordered
      .map((l, i) => ({ id: l.id, num: i + 1, old: l.episodeNumber }))
      .filter((x) => x.num !== x.old);
    if (changed.length === 0) return;
    const results = await Promise.all(changed.map((c) =>
      fetch(`/api/lectures/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeNumber: c.num }),
      }),
    ));
    if (results.some((r) => !r.ok)) throw new Error();
    const numById = new Map(changed.map((c) => [c.id, c.num]));
    onLecturesChange((prev) => prev.map((l) => numById.has(l.id) ? { ...l, episodeNumber: numById.get(l.id)! } : l));
  };

  const handleAdd = async (lecId: string) => {
    if (!selectedId || busy) return;
    setBusy(true);
    const nextNum = episodes.reduce((m, e) => Math.max(m, e.episodeNumber ?? 0), 0) + 1;
    try {
      const res = await fetch(`/api/lectures/${lecId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: selectedId, episodeNumber: nextNum }),
      });
      if (!res.ok) throw new Error();
      onLecturesChange((prev) => prev.map((l) => l.id === lecId ? { ...l, seriesId: selectedId, episodeNumber: nextNum } : l));
    } catch {
      alert('강의 추가에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (lecId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/lectures/${lecId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: null, episodeNumber: null }),
      });
      if (!res.ok) throw new Error();
      onLecturesChange((prev) => prev.map((l) => l.id === lecId ? { ...l, seriesId: null, episodeNumber: null } : l));
      await applyOrder(episodes.filter((e) => e.id !== lecId));
    } catch {
      alert('강의 제외에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (busy || target < 0 || target >= episodes.length) return;
    setBusy(true);
    try {
      const reordered = [...episodes];
      [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
      await applyOrder(reordered);
    } catch {
      alert('순서 변경에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // 강의명·태그로 검색되는, 시리즈에 속하지 않은 강의 목록
  const addPool = lectures.filter((l) => {
    if (l.seriesId) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [l.title, ...l.subjects, ...l.levels, ...l.targetGrades, ...(l.etcTags ?? [])]
      .join(' ').toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      {/* 좌측: 시리즈 목록 */}
      <div className="w-[240px] shrink-0 bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-[#f1f5f9] flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">시리즈 목록</span>
          <button
            onClick={() => { setAdding((v) => !v); setNewTitle(''); }}
            className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[15px] font-bold text-white shrink-0 leading-none"
            style={{ background: adding ? '#9ca3af' : '#5B4FBE' }}
            title="시리즈 추가"
          >
            {adding ? '×' : '+'}
          </button>
        </div>
        {adding && (
          <div className="px-3 py-2.5 border-b border-[#f1f5f9] bg-[#f9fafb] flex flex-col gap-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="새 시리즈명 입력"
              className="w-full text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[7px] bg-white outline-none focus:border-[#a78bfa]"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="px-3 py-1.5 rounded-[7px] text-[12px] font-medium text-white disabled:opacity-50"
              style={{ background: '#5B4FBE' }}
            >
              {creating ? '생성 중...' : '시리즈 추가'}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {seriesLoading ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
          ) : seriesList.length === 0 ? (
            <p className="text-[12px] text-[#9ca3af] text-center py-6 px-3 leading-relaxed">등록된 시리즈가 없습니다<br />+ 버튼으로 추가하세요</p>
          ) : (
            seriesList.map((s) => {
              const count  = episodesOf(s.id).length;
              const active = selectedId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#f1f5f9] cursor-pointer hover:bg-gray-50 last:border-none"
                  style={active ? { background: '#EEEDFE', borderLeft: '3px solid #a78bfa', paddingLeft: 11 } : {}}
                >
                  <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                    <span style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '9px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold truncate" style={{ color: active ? '#534AB7' : '#111827' }}>{s.title}</p>
                    <p className="text-[10.5px] text-[#9ca3af]">총 {count}강</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 우측: 시리즈 구성 */}
      {!selectedSeries ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af] bg-white border border-[#e2e8f0] rounded-[10px]">
          {seriesLoading ? '불러오는 중...' : '왼쪽에서 시리즈를 선택하거나 + 버튼으로 추가하세요'}
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* 시리즈 내 강의 — 순서 지정 */}
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#f1f5f9] flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#1a2535]">{selectedSeries.title}</span>
              <span className="text-[11px] text-[#9ca3af]">— 시리즈 내 강의 {episodes.length}개 · ▲▼로 순서 지정</span>
            </div>
            {loading ? (
              <p className="text-[12px] text-[#9ca3af] text-center py-8">불러오는 중...</p>
            ) : episodes.length === 0 ? (
              <p className="text-[12.5px] text-[#9ca3af] text-center py-8">아직 시리즈에 강의가 없습니다. 아래에서 강의를 추가하세요.</p>
            ) : (
              <div className="flex flex-col">
                {episodes.map((ep, idx) => (
                  <div key={ep.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[#f1f5f9] last:border-none">
                    <div className="flex flex-col shrink-0 gap-0.5">
                      <button
                        onClick={() => handleMove(idx, -1)}
                        disabled={busy || idx === 0}
                        className="w-7 h-[18px] flex items-center justify-center rounded-[5px] text-[10px] bg-[#f1f5f9] text-[#6b7280] hover:bg-[#EEEDFE] hover:text-[#5B4FBE] disabled:opacity-30 transition-colors"
                        aria-label="위로 이동"
                      >▲</button>
                      <button
                        onClick={() => handleMove(idx, 1)}
                        disabled={busy || idx === episodes.length - 1}
                        className="w-7 h-[18px] flex items-center justify-center rounded-[5px] text-[10px] bg-[#f1f5f9] text-[#6b7280] hover:bg-[#EEEDFE] hover:text-[#5B4FBE] disabled:opacity-30 transition-colors"
                        aria-label="아래로 이동"
                      >▼</button>
                    </div>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: '#EEEDFE', color: '#534AB7' }}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-[#111827] truncate">{ep.title}</p>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {lectureTags(ep).slice(0, 4).map((t) => (
                          <span key={t.label} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(ep.id)}
                      disabled={busy}
                      className="px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#dc2626] hover:border-[#fca5a5] disabled:opacity-50 shrink-0"
                    >
                      시리즈에서 제외
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 강의 추가 */}
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">강의 추가</div>
            <div className="p-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="강의명·태그로 검색 (예: 수학, 심화)"
                className="w-full text-[12.5px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white mb-3"
              />
              {loading ? (
                <p className="text-[12px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
              ) : addPool.length === 0 ? (
                <p className="text-[12px] text-[#9ca3af] text-center py-6">
                  {search.trim() ? '검색 결과가 없습니다' : '추가할 수 있는 강의가 없습니다 (시리즈 미지정 강의만 표시됩니다)'}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {addPool.map((l) => (
                    <div key={l.id} className="flex items-center gap-2.5 px-3 py-2 border border-[#e2e8f0] rounded-[8px]">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-[#111827] truncate">{l.title}</p>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {lectureTags(l).slice(0, 4).map((t) => (
                            <span key={t.label} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAdd(l.id)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-[7px] text-[11.5px] font-medium text-white disabled:opacity-50 shrink-0"
                        style={{ background: '#5B4FBE' }}
                      >
                        + 추가
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
function PageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const tabParam     = searchParams.get('tab') as TabId | null;

  const [tab,        setTab]        = useState<TabId>(tabParam ?? 'tags');
  const [lectures,   setLectures]   = useState<Lecture[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    fetch('/api/lectures')
      .then((r) => r.json())
      .then((data: Lecture[]) => {
        const list = Array.isArray(data) ? data : [];
        setLectures(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => setLectures([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setTab((tabParam as TabId) ?? 'tags');
  }, [tabParam]);

  const handleTab = (t: TabId) => {
    setTab(t);
    if (t === 'tags') router.replace('/ingang/lectures/targets');
    else router.replace(`/ingang/lectures/targets?tab=${t}`);
  };

  const selectedLec       = lectures.find((l) => l.id === selectedId) ?? null;
  const showLecturePanel  = tab === 'cond';
  const contentOverflow   = tab === 'exam' ? 'overflow-hidden' : 'overflow-y-auto';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">강의 세부사항</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강 · 강의 관리</span>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#e2e8f0] flex px-5 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
            className="py-2.5 px-4 text-[13px] border-b-2 transition-colors -mb-px"
            style={tab === t.id
              ? { color: '#a78bfa', borderColor: '#a78bfa', fontWeight: 600 }
              : { color: '#6b7280', borderColor: 'transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={`flex-1 ${contentOverflow} p-5 flex gap-4`}>
        {showLecturePanel && (
          <LecturePanel
            lectures={lectures}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            condMode={tab === 'cond'}
          />
        )}
        {tab === 'tags'   && <TagsContent  lectures={lectures} loading={loading} />}
        {tab === 'series' && <SeriesContent lectures={lectures} loading={loading} onLecturesChange={setLectures} />}
        {tab === 'target' && <TargetContent lectures={lectures} loading={loading} />}
        {tab === 'cond'   && <CondContent   selectedLec={selectedLec} />}
        {tab === 'exam'   && <ExamContent lectures={lectures} loading={loading} />}
        {tab === 'retry'  && <RetryContent />}
      </div>
    </div>
  );
}

export default function LectureDetailsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-[#9ca3af]">로딩 중...</div>}>
      <PageContent />
    </Suspense>
  );
}
