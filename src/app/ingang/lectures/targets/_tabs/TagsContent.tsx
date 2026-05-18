'use client';
import { useState, useEffect } from 'react';
import { type Tag, type TagType, type Lecture, CUSTOM_STYLE, lectureTags } from '../_shared';

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

// ─── Tab: 강의 분류/태그 ──────────────────────────────────────
export function TagsContent({ lectures, loading }: { lectures: Lecture[]; loading: boolean }) {
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
