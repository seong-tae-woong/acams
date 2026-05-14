'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Lecture = {
  id: string;
  title: string;
  subjects: string[];
  levels: string[];
  targetGrades: string[];
  etcTags: string[];
  duration: string;
  status: 'DRAFT' | 'PUBLISHED';
  teacher?: { name: string } | null;
  seriesId: string | null;
  episodeNumber: number | null;
  orderIndex: number;
};

type AcademyTag = { id: string; label: string; tagType: string };

type Series = {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED';
  _count: { lectures: number };
};

type LectureDetail = Lecture & {
  description: string;
  videoUrl: string | null;
  cfVideoId: string | null;
  teacherId: string | null;
};
// Lecture 타입에 이미 seriesId, episodeNumber, etcTags가 있으므로 LectureDetail은 그대로 사용

type SeriesDetail = Series & { orderIndex: number };

export default function LecturesPage() {
  const [lectures,      setLectures]      = useState<Lecture[]>([]);
  const [seriesList,    setSeriesList]    = useState<Series[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [search,        setSearch]        = useState('');
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editDetail,    setEditDetail]    = useState<LectureDetail | null>(null);
  const [editLoading,   setEditLoading]   = useState(false);
  const [editSaving,    setEditSaving]    = useState(false);
  const [editingSeriesId,   setEditingSeriesId]   = useState<string | null>(null);
  const [editSeriesDetail,  setEditSeriesDetail]  = useState<SeriesDetail | null>(null);
  const [editSeriesLoading, setEditSeriesLoading] = useState(false);
  const [editSeriesSaving,  setEditSeriesSaving]  = useState(false);
  const [showNewSeries,     setShowNewSeries]     = useState(false);
  const [newSeriesForm,     setNewSeriesForm]     = useState({ title: '', description: '', status: 'DRAFT' as 'DRAFT' | 'PUBLISHED' });
  const [newSeriesSaving,   setNewSeriesSaving]   = useState(false);
  const [academyTags,       setAcademyTags]       = useState<AcademyTag[]>([]);
  const [editDeleting,      setEditDeleting]      = useState(false);
  const [editSeriesDeleting,setEditSeriesDeleting]= useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/lectures').then((r) => r.json()),
      fetch('/api/lecture-series').then((r) => r.json()),
      fetch('/api/lectures/tags').then((r) => r.json()),
    ])
      .then(([lecs, series, tags]) => {
        setLectures(Array.isArray(lecs) ? lecs : []);
        setSeriesList(Array.isArray(series) ? series : []);
        setAcademyTags(Array.isArray(tags) ? tags : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const matchesFilter = (l: Lecture) => {
    if (subjectFilter && !l.subjects.includes(subjectFilter)) return false;
    if (statusFilter  && l.status !== statusFilter)           return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        l.title,
        ...l.subjects,
        ...l.levels,
        ...l.targetGrades,
        ...(l.etcTags ?? []),
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const episodesOf = (seriesId: string) =>
    lectures
      .filter((l) => l.seriesId === seriesId && matchesFilter(l))
      .sort((a, b) => (a.episodeNumber ?? a.orderIndex) - (b.episodeNumber ?? b.orderIndex));

  const seriesSubjects = (seriesId: string) => {
    const set = new Set<string>();
    lectures.filter((l) => l.seriesId === seriesId).forEach((l) => l.subjects.forEach((s) => set.add(s)));
    return Array.from(set);
  };

  const standalone = lectures.filter((l) => !l.seriesId && matchesFilter(l));

  const visibleSeries = seriesList.filter((s) =>
    !subjectFilter && !statusFilter && !search ? true : episodesOf(s.id).length > 0
  );

  const isEmpty = visibleSeries.length === 0 && standalone.length === 0;

  const openEdit = async (id: string) => {
    setEditingId(id);
    setEditDetail(null);
    setEditLoading(true);
    try {
      const res = await fetch(`/api/lectures/${id}`);
      const data = await res.json();
      setEditDetail(data);
    } catch {
      alert('강의 정보를 불러오지 못했습니다.');
      setEditingId(null);
    } finally {
      setEditLoading(false);
    }
  };

  const closeEdit = () => { setEditingId(null); setEditDetail(null); };

  const handleEditDelete = async () => {
    if (!editDetail) return;
    if (!confirm(`정말로 "${editDetail.title}" 강의를 삭제하시겠습니까?\n삭제 후 되돌릴 수 없습니다.`)) return;
    setEditDeleting(true);
    try {
      const res = await fetch(`/api/lectures/${editDetail.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setLectures((prev) => prev.filter((l) => l.id !== editDetail.id));
      closeEdit();
    } catch {
      alert('강의 삭제에 실패했습니다.');
    } finally {
      setEditDeleting(false);
    }
  };

  const openEditSeries = async (id: string) => {
    setEditingSeriesId(id);
    setEditSeriesDetail(null);
    setEditSeriesLoading(true);
    try {
      const res = await fetch(`/api/lecture-series/${id}`);
      const data = await res.json();
      setEditSeriesDetail(data);
    } catch {
      alert('시리즈 정보를 불러오지 못했습니다.');
      setEditingSeriesId(null);
    } finally {
      setEditSeriesLoading(false);
    }
  };

  const closeEditSeries = () => { setEditingSeriesId(null); setEditSeriesDetail(null); };

  const handleEditSeriesDelete = async () => {
    if (!editSeriesDetail) return;
    const epCount = lectures.filter((l) => l.seriesId === editSeriesDetail.id).length;
    const warn = epCount > 0
      ? `정말로 "${editSeriesDetail.title}" 시리즈를 삭제하시겠습니까?\n이 시리즈에 등록된 ${epCount}개 강의는 시리즈 연결만 해제되고 단독 강의로 남습니다.\n삭제 후 되돌릴 수 없습니다.`
      : `정말로 "${editSeriesDetail.title}" 시리즈를 삭제하시겠습니까?\n삭제 후 되돌릴 수 없습니다.`;
    if (!confirm(warn)) return;
    setEditSeriesDeleting(true);
    try {
      // 시리즈에 속한 강의들의 seriesId를 먼저 해제 (FK 제약 회피)
      if (epCount > 0) {
        await Promise.all(
          lectures
            .filter((l) => l.seriesId === editSeriesDetail.id)
            .map((l) =>
              fetch(`/api/lectures/${l.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seriesId: null, episodeNumber: null }),
              })
            )
        );
        setLectures((prev) =>
          prev.map((l) =>
            l.seriesId === editSeriesDetail.id ? { ...l, seriesId: null, episodeNumber: null } : l
          )
        );
      }
      const res = await fetch(`/api/lecture-series/${editSeriesDetail.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setSeriesList((prev) => prev.filter((s) => s.id !== editSeriesDetail.id));
      closeEditSeries();
    } catch {
      alert('시리즈 삭제에 실패했습니다.');
    } finally {
      setEditSeriesDeleting(false);
    }
  };

  const handleNewSeriesSave = async () => {
    if (!newSeriesForm.title.trim()) { alert('시리즈명을 입력해주세요.'); return; }
    setNewSeriesSaving(true);
    try {
      const res = await fetch('/api/lecture-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSeriesForm),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setSeriesList((prev) => [...prev, created]);
      setShowNewSeries(false);
      setNewSeriesForm({ title: '', description: '', status: 'DRAFT' });
    } catch {
      alert('시리즈 생성에 실패했습니다.');
    } finally {
      setNewSeriesSaving(false);
    }
  };

  const handleEditSeriesSave = async () => {
    if (!editSeriesDetail) return;
    setEditSeriesSaving(true);
    try {
      const res = await fetch(`/api/lecture-series/${editSeriesDetail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editSeriesDetail.title,
          description: editSeriesDetail.description,
          orderIndex: editSeriesDetail.orderIndex,
          status: editSeriesDetail.status,
        }),
      });
      if (!res.ok) throw new Error();
      setSeriesList((prev) =>
        prev.map((s) =>
          s.id === editSeriesDetail.id
            ? { ...s, title: editSeriesDetail.title, description: editSeriesDetail.description, status: editSeriesDetail.status }
            : s
        )
      );
      closeEditSeries();
    } catch {
      alert('수정에 실패했습니다.');
    } finally {
      setEditSeriesSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editDetail) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/lectures/${editDetail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editDetail.title,
          description: editDetail.description,
          subjects: editDetail.subjects,
          levels: editDetail.levels,
          targetGrades: editDetail.targetGrades,
          etcTags: editDetail.etcTags ?? [],
          videoUrl: editDetail.videoUrl,
          duration: editDetail.duration,
          orderIndex: editDetail.orderIndex,
          status: editDetail.status,
          seriesId: editDetail.seriesId,
          episodeNumber: editDetail.episodeNumber,
        }),
      });
      if (!res.ok) throw new Error();
      setLectures((prev) =>
        prev.map((l) =>
          l.id === editDetail.id
            ? { ...l, title: editDetail.title, subjects: editDetail.subjects, levels: editDetail.levels, targetGrades: editDetail.targetGrades, etcTags: editDetail.etcTags ?? [], duration: editDetail.duration, status: editDetail.status, orderIndex: editDetail.orderIndex, seriesId: editDetail.seriesId, episodeNumber: editDetail.episodeNumber }
            : l
        )
      );
      closeEdit();
    } catch {
      alert('수정에 실패했습니다.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Topbar */}
      <div className="h-[50px] bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-3 shrink-0">
        <span className="text-[15px] font-semibold text-[#1a2535]">강의 목록</span>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: '#EEEDFE', color: '#534AB7' }}>인강</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowNewSeries(true)}
            className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium border border-[#e2e8f0] bg-white text-[#374151] hover:bg-gray-50"
          >
            + 시리즈 추가
          </button>
          <Link
            href="/ingang/lectures/new"
            className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white"
            style={{ background: '#5B4FBE' }}
          >
            + 강의 등록
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Toolbar */}
        <div className="flex items-center gap-2.5">
          <select
            value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
            className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none"
          >
            <option value="">전체 과목</option>
            <option value="수학">수학</option>
            <option value="영어">영어</option>
            <option value="국어">국어</option>
            <option value="과학">과학</option>
          </select>
          <select
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none"
          >
            <option value="">전체 상태</option>
            <option value="PUBLISHED">게시됨</option>
            <option value="DRAFT">임시저장</option>
          </select>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="강의명·태그 검색 (예: 수학)"
            className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none w-44"
          />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">불러오는 중...</div>
        ) : isEmpty ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">
            {lectures.length === 0 && seriesList.length === 0 ? '등록된 강의가 없습니다' : '검색 결과가 없습니다'}
          </div>
        ) : (
          <>
            {/* ── 시리즈 강좌 ───────────────────────────── */}
            {visibleSeries.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#6b7280]">시리즈 강좌</p>
                {visibleSeries.map((series) => {
                  const episodes = episodesOf(series.id);
                  const isOpen   = expandedId === series.id;
                  const subjects = seriesSubjects(series.id);

                  return (
                    <div key={series.id} className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden transition-all" style={isOpen ? { borderColor: '#a78bfa' } : {}}>
                      {/* 시리즈 헤더 */}
                      <div
                        onClick={() => setExpandedId(isOpen ? null : series.id)}
                        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#fafafa] transition-colors select-none"
                      >
                        <div
                          className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0"
                          style={{ background: '#1e1b2e' }}
                        >
                          <span style={{ borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '11px solid #a78bfa', marginLeft: 2, display: 'inline-block' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-semibold text-[#111827]">{series.title}</p>
                          <p className="text-[11.5px] text-[#9ca3af] mt-0.5">
                            총 {series._count.lectures}강
                            {subjects.length > 0 && <span> · {subjects.join(' · ')}</span>}
                          </p>
                        </div>
                        {series.status === 'PUBLISHED' ? (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: '#D1FAE5', color: '#065f46' }}>게시됨</span>
                        ) : (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: '#FEF3C7', color: '#92400e' }}>임시저장</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditSeries(series.id); }}
                          className="px-2 py-1 rounded-[6px] text-[11px] border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-gray-50 shrink-0"
                        >
                          수정
                        </button>
                        <span className="text-[11px] text-[#9ca3af] shrink-0 w-4 text-center">{isOpen ? '▲' : '▼'}</span>
                      </div>

                      {/* 에피소드 목록 */}
                      {isOpen && (
                        <div className="border-t border-[#f1f5f9]">
                          {episodes.length === 0 ? (
                            <p className="px-4 py-3.5 text-[12.5px] text-[#9ca3af]">이 시리즈에 등록된 강의가 없습니다.</p>
                          ) : (
                            episodes.map((ep, idx) => (
                              <div
                                key={ep.id}
                                className="flex items-center gap-3 px-4 py-3 border-b border-[#f1f5f9] last:border-none hover:bg-[#fafafa] transition-colors"
                              >
                                {/* 강 번호 배지 */}
                                <span
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                                  style={{ background: '#EEEDFE', color: '#534AB7' }}
                                >
                                  {ep.episodeNumber ?? idx + 1}
                                </span>
                                <p className="flex-1 text-[12.5px] font-medium text-[#374151] truncate">{ep.title}</p>
                                <span className="text-[11px] text-[#9ca3af] shrink-0">{ep.duration}</span>
                                {ep.status === 'PUBLISHED' ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: '#D1FAE5', color: '#065f46' }}>게시</span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: '#FEF3C7', color: '#92400e' }}>임시</span>
                                )}
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => openEdit(ep.id)} className="px-2 py-1 rounded-[6px] text-[11px] border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-gray-50">수정</button>
                                  <button className="px-2 py-1 rounded-[6px] text-[11px] border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-gray-50">미리보기</button>
                                </div>
                              </div>
                            ))
                          )}
                          {/* 강의 추가 버튼 */}
                          <div className="px-4 py-2.5 bg-[#fafafa] border-t border-[#f1f5f9]">
                            <Link
                              href={`/ingang/lectures/new?seriesId=${series.id}`}
                              className="text-[12px] font-semibold hover:underline"
                              style={{ color: '#5B4FBE' }}
                            >
                              + {series.title}에 강의 추가
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* ── 단독 강의 ─────────────────────────────── */}
            {standalone.length > 0 && (
              <section className="flex flex-col gap-2.5">
                {visibleSeries.length > 0 && (
                  <p className="text-[11.5px] font-semibold uppercase tracking-wider text-[#6b7280]">단독 강의</p>
                )}
                <div className="grid grid-cols-3 gap-3.5">
                  {standalone.map((lec) => (
                    <div
                      key={lec.id}
                      className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden cursor-pointer transition-all hover:border-[#a78bfa] hover:shadow-md"
                    >
                      <div
                        className="h-[110px] flex items-center justify-center relative"
                        style={{ background: lec.status === 'DRAFT' ? '#2a2040' : '#1e1b2e' }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(167,139,250,0.25)', border: '2px solid rgba(167,139,250,0.5)', opacity: lec.status === 'DRAFT' ? 0.5 : 1 }}
                        >
                          <span style={{ borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '15px solid #a78bfa', marginLeft: 3, display: 'inline-block' }} />
                        </div>
                        <span
                          className="absolute bottom-2 right-2.5 text-[10.5px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(0,0,0,0.4)', color: lec.status === 'DRAFT' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)' }}
                        >
                          {lec.duration}
                        </span>
                        {lec.subjects.length > 0 && (
                          <span
                            className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(167,139,250,0.25)', color: '#c4b5fd' }}
                          >
                            {lec.subjects[0]}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-[13px] font-semibold text-[#111827] mb-2 leading-snug line-clamp-2">{lec.title}</p>
                        <div className="flex justify-between items-center pt-2 border-t border-[#f1f5f9]">
                          {lec.status === 'PUBLISHED' ? (
                            <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#D1FAE5', color: '#065f46' }}>게시됨</span>
                          ) : (
                            <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#FEF3C7', color: '#92400e' }}>임시저장</span>
                          )}
                          <div className="flex gap-1.5">
                            <button onClick={() => openEdit(lec.id)} className="px-2 py-1 rounded-[6px] text-[11px] border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-gray-50">수정</button>
                            <button className="px-2 py-1 rounded-[6px] text-[11px] border border-[#e2e8f0] bg-white text-[#6b7280] hover:bg-gray-50">
                              {lec.status === 'DRAFT' ? '게시' : '시험'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* 강의 수정 모달 */}
      {editingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => e.target === e.currentTarget && closeEdit()}
        >
          <div className="bg-white rounded-[14px] shadow-2xl w-[540px] max-h-[85vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between shrink-0">
              <p className="text-[15px] font-bold text-[#1a2535]">강의 수정</p>
              <button onClick={closeEdit} className="text-[#9ca3af] hover:text-[#374151] text-[22px] leading-none">×</button>
            </div>

            {editLoading ? (
              <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af] py-12">불러오는 중...</div>
            ) : editDetail && (
              <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">

                {/* 제목 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">강의 제목 <span style={{ color: '#a78bfa' }}>*</span></label>
                  <input
                    value={editDetail.title}
                    onChange={(e) => setEditDetail({ ...editDetail, title: e.target.value })}
                    className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                    placeholder="강의 제목을 입력하세요"
                  />
                </div>

                {/* 설명 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">설명</label>
                  <textarea
                    value={editDetail.description ?? ''}
                    onChange={(e) => setEditDetail({ ...editDetail, description: e.target.value })}
                    rows={3}
                    className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white resize-none"
                    placeholder="강의 설명을 입력하세요"
                  />
                </div>

                {/* 시리즈 + 강 번호 */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">시리즈 <span className="font-normal text-[#9ca3af]">(선택)</span></label>
                    <select
                      value={editDetail.seriesId ?? ''}
                      onChange={(e) => setEditDetail({ ...editDetail, seriesId: e.target.value || null, episodeNumber: e.target.value ? (editDetail.episodeNumber ?? 1) : null })}
                      className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                    >
                      <option value="">시리즈 없음</option>
                      {seriesList.map((s) => (
                        <option key={s.id} value={s.id}>{s.title} ({s._count.lectures}강)</option>
                      ))}
                    </select>
                  </div>
                  {editDetail.seriesId && (
                    <div className="w-28">
                      <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">강 번호</label>
                      <input
                        type="number"
                        min={1}
                        value={editDetail.episodeNumber ?? ''}
                        onChange={(e) => setEditDetail({ ...editDetail, episodeNumber: e.target.value ? +e.target.value : null })}
                        className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* YouTube Embed URL */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">YouTube Embed URL</label>
                  <input
                    value={editDetail.videoUrl ?? ''}
                    onChange={(e) => setEditDetail({ ...editDetail, videoUrl: e.target.value || null })}
                    placeholder="https://www.youtube.com/embed/..."
                    className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                  />
                </div>

                {/* 영상 길이 + 순서 */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">영상 길이</label>
                    <input
                      value={editDetail.duration}
                      onChange={(e) => setEditDetail({ ...editDetail, duration: e.target.value })}
                      placeholder="예: 32:15"
                      className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">순서</label>
                    <input
                      type="number"
                      value={editDetail.orderIndex}
                      onChange={(e) => setEditDetail({ ...editDetail, orderIndex: +e.target.value })}
                      className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                    />
                  </div>
                </div>

                {/* 상태 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">상태</label>
                  <div className="flex gap-2">
                    {(['DRAFT', 'PUBLISHED'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setEditDetail({ ...editDetail, status: s })}
                        className="px-4 py-1.5 rounded-[8px] text-[12.5px] font-medium border-[1.5px] transition-all"
                        style={editDetail.status === s
                          ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' }
                          : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}
                      >
                        {s === 'DRAFT' ? '임시저장' : '게시됨'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 과목 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">과목</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['수학','영어','국어','과학'] as const).map((s) => {
                      const on = editDetail.subjects.includes(s);
                      const colors: Record<string, { bg: string; color: string; border: string }> = {
                        '수학': { bg: '#DBEAFE', color: '#1d4ed8', border: '#93c5fd' },
                        '영어': { bg: '#D1FAE5', color: '#065f46', border: '#6ee7b7' },
                        '국어': { bg: '#FEF3C7', color: '#92400e', border: '#fcd34d' },
                        '과학': { bg: '#FEE2E2', color: '#991b1b', border: '#fca5a5' },
                      };
                      return (
                        <button key={s}
                          onClick={() => setEditDetail({ ...editDetail, subjects: on ? editDetail.subjects.filter((x) => x !== s) : [...editDetail.subjects, s] })}
                          className="px-3 py-1 rounded-full text-[12px] border-[1.5px] font-medium"
                          style={on ? colors[s] : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e2e8f0' }}
                        >
                          {on && <span className="mr-1 text-[10px]">✓</span>}{s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 레벨 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">레벨</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['기초','심화','최상위'] as const).map((s) => {
                      const on = editDetail.levels.includes(s);
                      const colors: Record<string, { bg: string; color: string; border: string }> = {
                        '기초':   { bg: '#E1F5EE', color: '#065f46', border: '#4fc3a1' },
                        '심화':   { bg: '#EEEDFE', color: '#534AB7', border: '#a78bfa' },
                        '최상위': { bg: '#FEF9C3', color: '#713f12', border: '#fde047' },
                      };
                      return (
                        <button key={s}
                          onClick={() => setEditDetail({ ...editDetail, levels: on ? editDetail.levels.filter((x) => x !== s) : [...editDetail.levels, s] })}
                          className="px-3 py-1 rounded-full text-[12px] border-[1.5px] font-medium"
                          style={on ? colors[s] : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e2e8f0' }}
                        >
                          {on && <span className="mr-1 text-[10px]">✓</span>}{s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 대상 학년 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">대상 학년</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3'].map((g) => {
                      const on = editDetail.targetGrades.includes(g);
                      return (
                        <button key={g}
                          onClick={() => setEditDetail({ ...editDetail, targetGrades: on ? editDetail.targetGrades.filter((x) => x !== g) : [...editDetail.targetGrades, g] })}
                          className="px-3 py-1 rounded-full text-[12px] border-[1.5px] font-medium"
                          style={on ? { background: '#f1f5f9', color: '#374151', borderColor: '#94a3b8' } : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e2e8f0' }}
                        >
                          {on && <span className="mr-1 text-[10px]">✓</span>}{g}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 기타 태그 (학원 전용) */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">기타</label>
                  {academyTags.filter((t) => t.tagType === 'etc').length === 0 ? (
                    <p className="text-[11.5px] text-[#9ca3af] italic">강의 세부사항 → 태그 관리에서 기타 태그를 먼저 추가하세요</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {academyTags.filter((t) => t.tagType === 'etc').map((t) => {
                        const on = (editDetail.etcTags ?? []).includes(t.label);
                        return (
                          <button key={t.id}
                            onClick={() => {
                              const cur = editDetail.etcTags ?? [];
                              setEditDetail({ ...editDetail, etcTags: on ? cur.filter((x) => x !== t.label) : [...cur, t.label] });
                            }}
                            className="px-3 py-1 rounded-full text-[12px] border-[1.5px] font-medium"
                            style={on
                              ? { background: '#F5F3FF', color: '#6D28D9', borderColor: '#C4B5FD' }
                              : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e2e8f0' }}
                          >
                            {on && <span className="mr-1 text-[10px]">✓</span>}{t.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* 모달 푸터 */}
            <div className="px-5 py-3.5 border-t border-[#e2e8f0] flex items-center justify-between shrink-0">
              <button
                onClick={handleEditDelete}
                disabled={editDeleting || editLoading || editSaving}
                className="px-3.5 py-2 rounded-[8px] text-[12.5px] font-medium border border-[#fca5a5] text-[#dc2626] bg-white hover:bg-[#fef2f2] disabled:opacity-60"
              >
                {editDeleting ? '삭제 중...' : '🗑 강의 삭제'}
              </button>
              <div className="flex gap-2">
                <button onClick={closeEdit} className="px-4 py-2 rounded-[8px] text-[13px] font-medium border border-[#e2e8f0] bg-white text-[#374151] hover:bg-gray-50">취소</button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving || editLoading || editDeleting || !editDetail?.title?.trim()}
                  className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-white disabled:opacity-60"
                  style={{ background: '#5B4FBE' }}
                >
                  {editSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 시리즈 추가 모달 */}
      {showNewSeries && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => e.target === e.currentTarget && setShowNewSeries(false)}
        >
          <div className="bg-white rounded-[14px] shadow-2xl w-[460px] flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between shrink-0">
              <p className="text-[15px] font-bold text-[#1a2535]">시리즈 추가</p>
              <button onClick={() => setShowNewSeries(false)} className="text-[#9ca3af] hover:text-[#374151] text-[22px] leading-none">×</button>
            </div>
            <div className="p-5 flex flex-col gap-4">

              <div>
                <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">시리즈명 <span style={{ color: '#a78bfa' }}>*</span></label>
                <input
                  value={newSeriesForm.title}
                  onChange={(e) => setNewSeriesForm({ ...newSeriesForm, title: e.target.value })}
                  autoFocus
                  className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                  placeholder="예: 중등 수학 기초 완성"
                  onKeyDown={(e) => e.key === 'Enter' && !newSeriesSaving && handleNewSeriesSave()}
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">설명</label>
                <textarea
                  value={newSeriesForm.description}
                  onChange={(e) => setNewSeriesForm({ ...newSeriesForm, description: e.target.value })}
                  rows={3}
                  className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white resize-none"
                  placeholder="시리즈 설명을 입력하세요"
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">상태</label>
                <div className="flex gap-2">
                  {(['DRAFT', 'PUBLISHED'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setNewSeriesForm({ ...newSeriesForm, status: s })}
                      className="px-4 py-1.5 rounded-[8px] text-[12.5px] font-medium border-[1.5px] transition-all"
                      style={newSeriesForm.status === s
                        ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' }
                        : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}
                    >
                      {s === 'DRAFT' ? '임시저장' : '게시됨'}
                    </button>
                  ))}
                </div>
              </div>

            </div>
            <div className="px-5 py-3.5 border-t border-[#e2e8f0] flex justify-end gap-2 shrink-0">
              <button onClick={() => setShowNewSeries(false)} className="px-4 py-2 rounded-[8px] text-[13px] font-medium border border-[#e2e8f0] bg-white text-[#374151] hover:bg-gray-50">취소</button>
              <button
                onClick={handleNewSeriesSave}
                disabled={newSeriesSaving || !newSeriesForm.title.trim()}
                className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-white disabled:opacity-60"
                style={{ background: '#5B4FBE' }}
              >
                {newSeriesSaving ? '생성 중...' : '시리즈 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 시리즈 수정 모달 */}
      {editingSeriesId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => e.target === e.currentTarget && closeEditSeries()}
        >
          <div className="bg-white rounded-[14px] shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between shrink-0">
              <p className="text-[15px] font-bold text-[#1a2535]">시리즈 수정</p>
              <button onClick={closeEditSeries} className="text-[#9ca3af] hover:text-[#374151] text-[22px] leading-none">×</button>
            </div>

            {editSeriesLoading ? (
              <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af] py-12">불러오는 중...</div>
            ) : editSeriesDetail && (
              <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">

                {/* 시리즈명 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">시리즈명 <span style={{ color: '#a78bfa' }}>*</span></label>
                  <input
                    value={editSeriesDetail.title}
                    onChange={(e) => setEditSeriesDetail({ ...editSeriesDetail, title: e.target.value })}
                    className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                    placeholder="시리즈명을 입력하세요"
                  />
                </div>

                {/* 설명 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">설명</label>
                  <textarea
                    value={editSeriesDetail.description ?? ''}
                    onChange={(e) => setEditSeriesDetail({ ...editSeriesDetail, description: e.target.value })}
                    rows={3}
                    className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white resize-none"
                    placeholder="시리즈 설명을 입력하세요"
                  />
                </div>

                {/* 순서 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">목록 순서</label>
                  <input
                    type="number"
                    value={editSeriesDetail.orderIndex}
                    onChange={(e) => setEditSeriesDetail({ ...editSeriesDetail, orderIndex: +e.target.value })}
                    className="w-28 text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                  />
                </div>

                {/* 상태 */}
                <div>
                  <label className="text-[12px] font-semibold text-[#374151] block mb-1.5">상태</label>
                  <div className="flex gap-2">
                    {(['DRAFT', 'PUBLISHED'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setEditSeriesDetail({ ...editSeriesDetail, status: s })}
                        className="px-4 py-1.5 rounded-[8px] text-[12.5px] font-medium border-[1.5px] transition-all"
                        style={editSeriesDetail.status === s
                          ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' }
                          : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }}
                      >
                        {s === 'DRAFT' ? '임시저장' : '게시됨'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 푸터 */}
            <div className="px-5 py-3.5 border-t border-[#e2e8f0] flex items-center justify-between shrink-0">
              <button
                onClick={handleEditSeriesDelete}
                disabled={editSeriesDeleting || editSeriesLoading || editSeriesSaving}
                className="px-3.5 py-2 rounded-[8px] text-[12.5px] font-medium border border-[#fca5a5] text-[#dc2626] bg-white hover:bg-[#fef2f2] disabled:opacity-60"
              >
                {editSeriesDeleting ? '삭제 중...' : '🗑 시리즈 삭제'}
              </button>
              <div className="flex gap-2">
                <button onClick={closeEditSeries} className="px-4 py-2 rounded-[8px] text-[13px] font-medium border border-[#e2e8f0] bg-white text-[#374151] hover:bg-gray-50">취소</button>
                <button
                  onClick={handleEditSeriesSave}
                  disabled={editSeriesSaving || editSeriesLoading || editSeriesDeleting || !editSeriesDetail?.title?.trim()}
                  className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-white disabled:opacity-60"
                  style={{ background: '#5B4FBE' }}
                >
                  {editSeriesSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
