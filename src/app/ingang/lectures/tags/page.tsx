'use client';
import { useState, useEffect } from 'react';

// ─── 타입 ────────────────────────────────────────────────
type Tag = {
  id?: string;       // DB에 저장된 커스텀 태그만 id 존재
  label: string;
  bg: string;
  color: string;
  border: string;
};

type TagType = 'subject' | 'level' | 'grade';

// ─── 기본 태그 (모든 학원 공통) ──────────────────────────
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

// 커스텀 태그 스타일 (학원별로 추가한 태그)
const CUSTOM_STYLE = { bg: '#F5F3FF', color: '#6D28D9', border: '#C4B5FD' };

// ─── 강의별 태그 표시용 ──────────────────────────────────
type LectureRow = { id: string; title: string; subjects: string[]; levels: string[]; targetGrades: string[] };

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

function lectureTags(lec: LectureRow): Pick<Tag, 'label' | 'bg' | 'color'>[] {
  return [
    ...lec.subjects.map((s) => ({ label: s, ...(SUBJECT_MAP[s] ?? CUSTOM_STYLE) })),
    ...lec.levels.map((l) => ({ label: l, ...(LEVEL_MAP[l] ?? CUSTOM_STYLE) })),
    ...lec.targetGrades.map((g) => ({ label: g, bg: '#f1f5f9', color: '#374151' })),
  ];
}

// ─── TagGroup 컴포넌트 ───────────────────────────────────
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
    try {
      await onAdd(trimmed);
      setInputVal('');
    } finally {
      setAdding(false);
    }
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
                <span
                  className="cursor-pointer opacity-60 hover:opacity-100 text-[12px]"
                  onClick={() => onDelete(t)}
                >×</span>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !adding && handleAdd()}
            placeholder={inputPlaceholder}
            className="flex-1 text-[12.5px] px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !inputVal.trim()}
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

// ─── 페이지 ──────────────────────────────────────────────
export default function LectureTagsPage() {
  const [subjects, setSubjects] = useState<Tag[]>(DEFAULT_SUBJECTS);
  const [levels,   setLevels]   = useState<Tag[]>(DEFAULT_LEVELS);
  const [grades,   setGrades]   = useState<Tag[]>(DEFAULT_GRADES);
  const [lectures, setLectures] = useState<LectureRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  // 커스텀 태그 + 강의 목록 로드
  useEffect(() => {
    Promise.all([
      fetch('/api/lectures/tags').then((r) => r.json()),
      fetch('/api/lectures').then((r) => r.json()),
    ])
      .then(([tagData, lectureData]) => {
        if (Array.isArray(tagData)) {
          const make = (t: { id: string; label: string }): Tag => ({ ...CUSTOM_STYLE, ...t });
          setSubjects((p) => [...p, ...tagData.filter((t) => t.tagType === 'subject').map(make)]);
          setLevels((p)   => [...p, ...tagData.filter((t) => t.tagType === 'level').map(make)]);
          setGrades((p)   => [...p, ...tagData.filter((t) => t.tagType === 'grade').map(make)]);
        }
        if (Array.isArray(lectureData)) setLectures(lectureData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── 태그 추가 ──────────────────────────────────────────
  const makeAdder = (
    tagType: TagType,
    currentTags: Tag[],
    setList: React.Dispatch<React.SetStateAction<Tag[]>>,
  ) => async (label: string) => {
    if (currentTags.some((t) => t.label === label)) {
      alert('이미 존재하는 태그입니다.');
      return;
    }
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

  // ── 태그 삭제 ──────────────────────────────────────────
  const makeDeleter = (
    setList: React.Dispatch<React.SetStateAction<Tag[]>>,
  ) => async (tag: Tag) => {
    if (tag.id) {
      const res = await fetch(`/api/lectures/tags/${tag.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? '태그 삭제에 실패했습니다.');
        return;
      }
    }
    setList((p) => p.filter((t) => t.label !== tag.label));
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">강의 분류/태그</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강 · 강의 관리</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex gap-4">
        {/* Left: 강의별 태그 설정 */}
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

        {/* Right: 태그 관리 */}
        <div className="w-[340px] shrink-0 flex flex-col gap-3.5">
          <div className="px-1">
            <p className="text-[11.5px] font-semibold text-[#6b7280] mb-0.5">태그 관리</p>
            <p className="text-[11px] text-[#9ca3af]">
              기본 태그는 모든 학원 공통 · <span style={{ color: CUSTOM_STYLE.color }}>보라색 태그</span>는 이 학원에서 추가한 태그
            </p>
          </div>
          <TagGroup
            title="과목 태그"
            tags={subjects}
            onDelete={makeDeleter(setSubjects)}
            onAdd={makeAdder('subject', subjects, setSubjects)}
            inputPlaceholder="새 과목 입력 (예: 사회)"
          />
          <TagGroup
            title="레벨 태그"
            tags={levels}
            onDelete={makeDeleter(setLevels)}
            onAdd={makeAdder('level', levels, setLevels)}
            inputPlaceholder="새 레벨 입력 (예: 최고급)"
          />
          <TagGroup
            title="대상 학년 태그"
            tags={grades}
            onDelete={makeDeleter(setGrades)}
            onAdd={makeAdder('grade', grades, setGrades)}
            inputPlaceholder="새 학년 입력 (예: 중2)"
          />
        </div>
      </div>
    </div>
  );
}
