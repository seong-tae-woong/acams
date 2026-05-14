'use client';
import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

type Lecture = { id: string; title: string; duration: string; status: 'DRAFT' | 'PUBLISHED' };
type StudentNote = {
  studentId: string;
  name: string;
  attendanceNumber: string;
  avatarColor: string;
  classes: { classId: string; className: string; color: string }[];
  note: string | null;
  updatedAt: string | null;
};

export default function StudentNotesPage() {
  const [lectures,    setLectures]    = useState<Lecture[]>([]);
  const [selectedLec, setSelectedLec] = useState<Lecture | null>(null);
  const [notes,       setNotes]       = useState<StudentNote[]>([]);
  const [lecLoading,  setLecLoading]  = useState(true);
  const [noteLoading, setNoteLoading] = useState(false);
  const [search,      setSearch]      = useState('');
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editText,    setEditText]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [lecOpen,     setLecOpen]     = useState(false);

  // 강의 목록 로드
  useEffect(() => {
    fetch('/api/lectures')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Lecture[]) => setLectures(Array.isArray(data) ? data.filter((l) => l.status === 'PUBLISHED') : []))
      .finally(() => setLecLoading(false));
  }, []);

  // 선택된 강의의 학생별 노트 로드
  const loadNotes = useCallback(async (lectureId: string) => {
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/lectures/${lectureId}/student-notes`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } finally {
      setNoteLoading(false);
    }
  }, []);

  const selectLecture = (lec: Lecture) => {
    setSelectedLec(lec);
    setLecOpen(false);
    setEditingId(null);
    loadNotes(lec.id);
  };

  const startEdit = (s: StudentNote) => {
    setEditingId(s.studentId);
    setEditText(s.note ?? '');
  };

  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  const saveNote = async (studentId: string) => {
    if (!selectedLec) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/lectures/${selectedLec.id}/student-notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, note: editText }),
      });
      if (!res.ok) { toast('저장에 실패했습니다.', 'error'); return; }
      setNotes((prev) => prev.map((n) =>
        n.studentId === studentId ? { ...n, note: editText || null, updatedAt: new Date().toISOString() } : n
      ));
      setEditingId(null);
      toast('코멘트를 저장했습니다.', 'success');
    } finally { setSaving(false); }
  };

  const deleteNote = async (studentId: string) => {
    if (!selectedLec) return;
    const res = await fetch(`/api/lectures/${selectedLec.id}/student-notes?studentId=${studentId}`, { method: 'DELETE' });
    if (res.ok) {
      setNotes((prev) => prev.map((n) => n.studentId === studentId ? { ...n, note: null, updatedAt: null } : n));
      toast('코멘트를 삭제했습니다.', 'success');
    }
  };

  const filtered = notes.filter((n) =>
    !search || n.name.includes(search) || n.attendanceNumber.includes(search)
  );
  const withNote    = filtered.filter((n) => n.note);
  const withoutNote = filtered.filter((n) => !n.note);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#f4f6f8]">
      {/* 헤더 */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare size={18} className="text-[#a78bfa]" />
          <h1 className="text-[15px] font-bold text-[#111827]">학생별 코멘트</h1>
          <span className="text-[11px] text-[#9ca3af]">태블릿 시청 시 학생에게 표시되는 강사 메시지</span>
        </div>

        {/* 강의 선택 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => setLecOpen((o) => !o)}
            className="flex items-center gap-2 w-full max-w-md bg-[#f4f6f8] border border-[#e2e8f0] rounded-[10px] px-4 py-2.5 text-[13px] text-left cursor-pointer hover:border-[#a78bfa] transition-colors"
          >
            <span className="flex-1 truncate text-[#111827]">
              {selectedLec ? selectedLec.title : lecLoading ? '강의 로딩 중...' : '강의를 선택하세요'}
            </span>
            {lecOpen ? <ChevronUp size={15} className="text-[#9ca3af]" /> : <ChevronDown size={15} className="text-[#9ca3af]" />}
          </button>

          {lecOpen && (
            <div className="absolute top-full left-0 mt-1 w-full max-w-md bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-20 max-h-60 overflow-y-auto">
              {lectures.length === 0 ? (
                <p className="px-4 py-3 text-[12.5px] text-[#9ca3af]">게시된 강의가 없습니다.</p>
              ) : lectures.map((l) => (
                <button
                  key={l.id}
                  onClick={() => selectLecture(l)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[12.5px] text-left hover:bg-[#f4f6f8] cursor-pointer transition-colors"
                >
                  <span className="flex-1 truncate text-[#111827]">{l.title}</span>
                  <span className="text-[11px] text-[#9ca3af] shrink-0">{l.duration}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 콘텐츠 */}
      {!selectedLec ? (
        <div className="flex-1 flex items-center justify-center text-[#9ca3af]">
          <div className="text-center">
            <MessageSquare size={36} className="mx-auto mb-3 opacity-25" />
            <p className="text-[13px]">강의를 선택하면 학생별 코멘트를 관리할 수 있습니다.</p>
          </div>
        </div>
      ) : noteLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {/* 검색 */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="학생 이름 또는 출결번호 검색"
                className="w-full pl-8 pr-3 py-2 text-[12.5px] border border-[#e2e8f0] rounded-[8px] focus:outline-none focus:border-[#a78bfa]"
              />
            </div>
            <span className="text-[12px] text-[#9ca3af]">
              코멘트 있음 {withNote.length}명 / 없음 {withoutNote.length}명
            </span>
          </div>

          {/* 코멘트 있는 학생 */}
          {withNote.length > 0 && (
            <div className="mb-6">
              <p className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-3">코멘트 있음</p>
              <div className="space-y-2">
                {withNote.map((s) => <NoteRow key={s.studentId} s={s} editing={editingId === s.studentId} editText={editText} onEdit={startEdit} onCancel={cancelEdit} onSave={saveNote} onDelete={deleteNote} onTextChange={setEditText} saving={saving} />)}
              </div>
            </div>
          )}

          {/* 코멘트 없는 학생 */}
          {withoutNote.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-3">코멘트 없음</p>
              <div className="space-y-2">
                {withoutNote.map((s) => <NoteRow key={s.studentId} s={s} editing={editingId === s.studentId} editText={editText} onEdit={startEdit} onCancel={cancelEdit} onSave={saveNote} onDelete={deleteNote} onTextChange={setEditText} saving={saving} />)}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#9ca3af]">
              <p className="text-[13px]">이 강의의 수강 학생이 없습니다.</p>
              <p className="text-[11px] mt-1">강의 대상 설정에서 반을 배정해주세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 학생 행 컴포넌트 ──────────────────────────────────
function NoteRow({
  s, editing, editText, onEdit, onCancel, onSave, onDelete, onTextChange, saving,
}: {
  s: StudentNote;
  editing: boolean;
  editText: string;
  onEdit: (s: StudentNote) => void;
  onCancel: () => void;
  onSave: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange: (v: string) => void;
  saving: boolean;
}) {
  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] px-4 py-3">
      <div className="flex items-start gap-3">
        {/* 아바타 */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0 mt-0.5"
          style={{ backgroundColor: s.avatarColor }}
        >
          {s.name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold text-[#111827]">{s.name}</span>
            <span className="text-[11px] text-[#9ca3af] font-mono">{s.attendanceNumber}</span>
            <div className="flex gap-1 flex-wrap">
              {s.classes.map((c) => (
                <span key={c.classId} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.color + '20', color: c.color }}>
                  {c.className}
                </span>
              ))}
            </div>
          </div>

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="학생에게 보여줄 강사 메시지를 입력하세요"
                rows={2}
                className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#a78bfa] resize-none"
              />
              <div className="flex gap-2">
                <button onClick={onCancel} disabled={saving} className="flex items-center gap-1 text-[11.5px] text-[#6b7280] hover:text-[#111827] cursor-pointer transition-colors">
                  <X size={12} /> 취소
                </button>
                <button onClick={() => onSave(s.studentId)} disabled={saving} className="flex items-center gap-1 text-[11.5px] text-[#a78bfa] hover:text-[#7c3aed] cursor-pointer transition-colors font-medium">
                  <Check size={12} /> {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              {s.note ? (
                <p className="text-[12.5px] text-[#374151] flex-1 leading-relaxed">💬 {s.note}</p>
              ) : (
                <p className="text-[12px] text-[#d1d5db] flex-1 italic">코멘트 없음</p>
              )}
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onEdit(s)} className="text-[11px] text-[#a78bfa] hover:text-[#7c3aed] cursor-pointer transition-colors">
                  {s.note ? '수정' : '+ 추가'}
                </button>
                {s.note && (
                  <button onClick={() => onDelete(s.studentId)} className="text-[11px] text-[#ef4444] hover:text-[#dc2626] cursor-pointer transition-colors">삭제</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
