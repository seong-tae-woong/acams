'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────
type TabId = 'tags' | 'target' | 'cond' | 'exam' | 'retry';

type Tag = { id?: string; label: string; bg: string; color: string; border: string };
type TagType = 'subject' | 'level' | 'grade';

type Lecture = {
  id: string;
  title: string;
  subjects: string[];
  levels: string[];
  targetGrades: string[];
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

// ─── Mock data (수강 대상 지정용 — DB 미연동 영역) ──────────────
const CLASSES = [
  { name: '초등수학 기초반', cnt: 6 },
  { name: '초등수학 심화반', cnt: 8 },
  { name: '영어 파닉스반',  cnt: 5 },
  { name: '중등수학 기초반', cnt: 7 },
  { name: '영어 회화반',    cnt: 4 },
];
const NUMS = ['①','②','③','④','⑤'];

// ─── Helpers ─────────────────────────────────────────────────
function lectureTags(lec: Pick<Lecture, 'subjects' | 'levels' | 'targetGrades'>) {
  return [
    ...lec.subjects.map((s) => ({ label: s, ...(SUBJECT_MAP[s] ?? CUSTOM_STYLE) })),
    ...lec.levels.map((l) => ({ label: l, ...(LEVEL_MAP[l] ?? CUSTOM_STYLE) })),
    ...lec.targetGrades.map((g) => ({ label: g, bg: '#f1f5f9', color: '#374151' })),
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
    <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">{title}</div>
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5 mb-3">
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
  const [subjects, setSubjects] = useState<Tag[]>(DEFAULT_SUBJECTS);
  const [levels,   setLevels]   = useState<Tag[]>(DEFAULT_LEVELS);
  const [grades,   setGrades]   = useState<Tag[]>(DEFAULT_GRADES);

  useEffect(() => {
    fetch('/api/lectures/tags')
      .then((r) => r.json())
      .then((tagData) => {
        if (!Array.isArray(tagData)) return;
        const make = (t: { id: string; label: string }): Tag => ({ ...CUSTOM_STYLE, ...t });
        setSubjects((p) => [...p, ...tagData.filter((t) => t.tagType === 'subject').map(make)]);
        setLevels((p)   => [...p, ...tagData.filter((t) => t.tagType === 'level').map(make)]);
        setGrades((p)   => [...p, ...tagData.filter((t) => t.tagType === 'grade').map(make)]);
      })
      .catch(() => {});
  }, []);

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

  return (
    <div className="flex-1 flex gap-4">
      <div className="flex-1 flex flex-col gap-3.5">
        <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535] flex items-center justify-between">
            강의별 태그 설정
            <span className="text-[12px] font-normal text-[#9ca3af]">강의를 클릭하면 태그를 수정할 수 있어요</span>
          </div>
          <div className="p-3.5 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 560 }}>
            {loading ? (
              <p className="text-[12.5px] text-[#9ca3af] text-center py-6">불러오는 중...</p>
            ) : lectures.length === 0 ? (
              <p className="text-[12.5px] text-[#9ca3af] text-center py-6">등록된 강의가 없습니다</p>
            ) : (
              lectures.map((lec, i) => (
                <div
                  key={lec.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 border rounded-[8px] cursor-pointer"
                  style={i === 0
                    ? { borderColor: '#a78bfa', background: 'rgba(167,139,250,0.07)' }
                    : { borderColor: '#e2e8f0', background: '#f9fafb' }}
                >
                  <div className="w-10 h-10 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                    <span style={{ borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '11px solid #a78bfa', marginLeft: 2, display: 'inline-block' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#111827] truncate">{lec.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lectureTags(lec).map((t) => (
                        <span key={t.label} className="text-[10.5px] px-2 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                      ))}
                    </div>
                  </div>
                  <button className="px-2.5 py-1 rounded-[6px] text-[11.5px] border border-[#e2e8f0] bg-white text-[#374151] shrink-0 hover:bg-gray-50">태그 수정</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="w-[340px] shrink-0 flex flex-col gap-3.5">
        <div className="px-1">
          <p className="text-[11.5px] font-semibold text-[#6b7280] mb-0.5">태그 관리</p>
          <p className="text-[11px] text-[#9ca3af]">
            기본 태그는 모든 학원 공통 · <span style={{ color: CUSTOM_STYLE.color }}>보라색 태그</span>는 이 학원에서 추가한 태그
          </p>
        </div>
        <TagGroup title="과목 태그" tags={subjects} onDelete={makeDeleter(setSubjects)} onAdd={makeAdder('subject', subjects, setSubjects)} inputPlaceholder="새 과목 입력 (예: 사회)" />
        <TagGroup title="레벨 태그" tags={levels} onDelete={makeDeleter(setLevels)} onAdd={makeAdder('level', levels, setLevels)} inputPlaceholder="새 레벨 입력 (예: 최고급)" />
        <TagGroup title="대상 학년 태그" tags={grades} onDelete={makeDeleter(setGrades)} onAdd={makeAdder('grade', grades, setGrades)} inputPlaceholder="새 학년 입력 (예: 중2)" />
      </div>
    </div>
  );
}

// ─── Tab: 수강 대상 지정 ──────────────────────────────────────
function TargetContent({ selectedLec }: { selectedLec: Lecture | null }) {
  const [targetType,   setTargetType]   = useState<'class' | 'individual' | 'all'>('class');
  const [checkedClass, setCheckedClass] = useState<string[]>([]);

  if (!selectedLec) return <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">강의를 선택해주세요</div>;

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">
          {selectedLec.title} — 수강 대상
        </div>
        <div className="flex gap-2 px-4 py-3 border-b border-[#f1f5f9]">
          {(['class','individual','all'] as const).map((t) => (
            <button key={t} onClick={() => setTargetType(t)}
              className="px-4 py-1.5 rounded-[8px] text-[12.5px] font-medium border-[1.5px] transition-all"
              style={targetType === t
                ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' }
                : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}>
              {t === 'class' ? '반 단위 지정' : t === 'individual' ? '개별 학생 지정' : '전체 공개'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 p-4">
          {CLASSES.map((c) => {
            const checked = checkedClass.includes(c.name);
            return (
              <div
                key={c.name}
                onClick={() => setCheckedClass(checked ? checkedClass.filter((x) => x !== c.name) : [...checkedClass, c.name])}
                className="flex items-center gap-2 px-3 py-2.5 border-[1.5px] rounded-[8px] cursor-pointer"
                style={checked ? { background: '#EEEDFE', borderColor: '#a78bfa' } : { borderColor: '#e2e8f0' }}
              >
                <div className="rounded flex items-center justify-center text-[10px] shrink-0"
                  style={checked ? { background: '#a78bfa', border: '1.5px solid #a78bfa', color: '#fff', width: 17, height: 17 } : { border: '1.5px solid #e2e8f0', width: 17, height: 17 }}>
                  {checked ? '✓' : ''}
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold" style={checked ? { color: '#534AB7' } : { color: '#111827' }}>{c.name}</p>
                  <p className="text-[10.5px] text-[#9ca3af]">{c.cnt}명</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#6b7280] leading-7">
        현재 수강 대상: <strong style={{ color: '#534AB7' }}>{checkedClass.length > 0 ? checkedClass.join(', ') : '미지정'}</strong>
        {checkedClass.length > 0 && <> — 총 {CLASSES.filter((c) => checkedClass.includes(c.name)).reduce((a, c) => a + c.cnt, 0)}명</>}
        <br />대상 변경 시 즉시 적용되며, 새로 추가된 학생에게는 강의가 표시됩니다.
      </div>
    </div>
  );
}

// ─── Tab: 이수 조건 설정 ──────────────────────────────────────
function CondContent({ selectedLec }: { selectedLec: Lecture | null }) {
  const [passScore, setPassScore] = useState(70);
  const [maxTries,  setMaxTries]  = useState(3);
  const [examCond,  setExamCond]  = useState<'after100' | 'anytime'>('after100');

  if (!selectedLec) return <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">강의를 선택해주세요</div>;

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] p-4">
        <p className="text-[13px] font-semibold text-[#1a2535] mb-4">{selectedLec.title} — 이수 조건</p>
        <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
          시험 합격 기준:
          <input type="number" value={passScore} onChange={(e) => setPassScore(+e.target.value)}
            className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]" />
          점 이상
        </div>
        <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
          최대 응시 횟수:
          <input type="number" value={maxTries} onChange={(e) => setMaxTries(+e.target.value)}
            className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]" />
          회
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <span className="text-[13px] text-[#374151]">시험 응시 조건:</span>
          <div className="flex gap-2">
            {(['after100','anytime'] as const).map((c) => (
              <button key={c} onClick={() => setExamCond(c)}
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
        <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50">초기화</button>
        <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>저장</button>
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
  const showLecturePanel  = tab === 'target' || tab === 'cond';
  const contentOverflow   = tab === 'exam' ? 'overflow-hidden' : 'overflow-y-auto';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">강의 세부사항</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강 · 강의 관리</span>
        {(tab === 'target' || tab === 'cond') && (
          <div className="ml-auto">
            <button className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white" style={{ background: '#5B4FBE' }}>저장</button>
          </div>
        )}
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
        {tab === 'target' && <TargetContent selectedLec={selectedLec} />}
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
