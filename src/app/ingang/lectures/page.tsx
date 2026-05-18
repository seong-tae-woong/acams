'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  PAGE_SIZE,
  type Lecture,
  type AcademyTag,
  type Series,
  type LectureDetail,
  type SeriesDetail,
} from './_shared';
import { SeriesTab } from './_components/SeriesTab';
import { LectureTab } from './_components/LectureTab';
import { EditLectureModal } from './_components/EditLectureModal';
import { NewSeriesModal } from './_components/NewSeriesModal';
import { EditSeriesModal } from './_components/EditSeriesModal';

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
  const [editVideoMode, setEditVideoMode] = useState<'youtube' | 'cloudflare'>('youtube');
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
  // 탭 + 무한 스크롤 윈도잉
  const [activeTab,         setActiveTab]         = useState<'series' | 'lecture'>('series');
  const [visibleCount,      setVisibleCount]      = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // lectureId → 소속 시리즈 제목 룩업 (강의별 탭 검색에서 시리즈 제목 매칭에 사용)
  const seriesTitleById  = new Map(seriesList.map((s) => [s.id, s.title]));
  const seriesTitleOfLec = (l: Lecture) => (l.seriesId ? seriesTitleById.get(l.seriesId) ?? '' : '');

  // 검색 외 필터(과목·상태)만 검사
  const matchesBaseFilter = (l: Lecture) => {
    if (subjectFilter && !l.subjects.includes(subjectFilter)) return false;
    if (statusFilter  && l.status !== statusFilter)           return false;
    return true;
  };

  // 강의 자체 텍스트(제목·태그)가 검색어와 일치하는지
  const lectureMatchesSearch = (l: Lecture, q: string) => {
    const hay = [
      l.title,
      ...l.subjects,
      ...l.levels,
      ...l.targetGrades,
      ...(l.etcTags ?? []),
    ].join(' ').toLowerCase();
    return hay.includes(q);
  };

  // 강의별 탭용: 과목·상태 필터 + (강의 제목 OR 소속 시리즈 제목) 검색
  const matchesFilter = (l: Lecture) => {
    if (!matchesBaseFilter(l)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!lectureMatchesSearch(l, q) && !seriesTitleOfLec(l).toLowerCase().includes(q)) return false;
    }
    return true;
  };

  const episodesOf = (seriesId: string) =>
    lectures
      .filter((l) => l.seriesId === seriesId && matchesBaseFilter(l))
      .sort((a, b) => (a.episodeNumber ?? a.orderIndex) - (b.episodeNumber ?? b.orderIndex));

  const seriesSubjects = (seriesId: string) => {
    const set = new Set<string>();
    lectures.filter((l) => l.seriesId === seriesId).forEach((l) => l.subjects.forEach((s) => set.add(s)));
    return Array.from(set);
  };

  // ── 시리즈별 탭 데이터 ──────────────────────────
  // 검색은 시리즈 제목으로, 과목·상태 필터는 소속 강의 기준으로 적용
  const filteredSeries = seriesList.filter((s) => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (subjectFilter || statusFilter) return episodesOf(s.id).length > 0;
    return true;
  });
  const visibleSeries = filteredSeries.slice(0, visibleCount);

  // ── 강의별 탭 데이터 ────────────────────────────
  // 시리즈 소속 여부와 무관하게 모든 강의를 하나의 평면 목록으로
  const filteredLectures = lectures
    .filter(matchesFilter)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const visibleLectures = filteredLectures.slice(0, visibleCount);

  const totalCount   = activeTab === 'series' ? filteredSeries.length : filteredLectures.length;
  const visibleLen   = activeTab === 'series' ? visibleSeries.length  : visibleLectures.length;
  const hasMore      = visibleLen < totalCount;
  const isEmpty      = totalCount === 0;

  // 탭·검색·필터 변경 시 윈도우를 다시 첫 페이지로 리셋
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab, search, subjectFilter, statusFilter]);

  // 스크롤이 하단 근처(80px)에 도달하면 다음 페이지 만큼 더 렌더
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      setVisibleCount((n) => n + PAGE_SIZE);
    }
  };

  const openEdit = async (id: string) => {
    setEditingId(id);
    setEditDetail(null);
    setEditLoading(true);
    try {
      const res = await fetch(`/api/lectures/${id}`);
      const data = await res.json();
      setEditDetail(data);
      setEditVideoMode(data.cfVideoId ? 'cloudflare' : 'youtube');
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
          videoUrl: editVideoMode === 'youtube' ? editDetail.videoUrl : null,
          cfVideoId: editVideoMode === 'cloudflare' ? editDetail.cfVideoId : null,
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
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* 탭 토글 (시리즈별 / 강의별) */}
        <div className="flex rounded-[8px] overflow-hidden border border-[#e2e8f0] text-[12.5px] font-medium w-fit">
          {([
            { key: 'series',  label: '시리즈별' },
            { key: 'lecture', label: '강의별' },
          ] as const).map((t, i) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 transition-colors ${i > 0 ? 'border-l border-[#e2e8f0]' : ''}`}
              style={activeTab === t.key
                ? { background: '#1a2535', color: '#fff' }
                : { background: '#fff', color: '#6b7280' }}
            >
              {t.label}
            </button>
          ))}
        </div>

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
            placeholder="강의명·시리즈명·태그 검색 (예: 수학)"
            className="text-[12.5px] px-2.5 py-1.5 border border-[#e2e8f0] rounded-[8px] bg-white text-[#374151] outline-none w-44"
          />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">불러오는 중...</div>
        ) : isEmpty ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">
            {lectures.length === 0 && seriesList.length === 0 ? '등록된 강의가 없습니다' : '검색 결과가 없습니다'}
          </div>
        ) : activeTab === 'series' ? (
          <SeriesTab
            visibleSeries={visibleSeries}
            filteredSeries={filteredSeries}
            hasMore={hasMore}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            episodesOf={episodesOf}
            seriesSubjects={seriesSubjects}
            openEditSeries={openEditSeries}
            openEdit={openEdit}
          />
        ) : (
          <LectureTab
            visibleLectures={visibleLectures}
            filteredLectures={filteredLectures}
            hasMore={hasMore}
            seriesTitleOfLec={seriesTitleOfLec}
            openEdit={openEdit}
          />
        )}
      </div>

      {/* 강의 수정 모달 */}
      {editingId && (
        <EditLectureModal
          editDetail={editDetail}
          setEditDetail={setEditDetail}
          editLoading={editLoading}
          editSaving={editSaving}
          editDeleting={editDeleting}
          editVideoMode={editVideoMode}
          setEditVideoMode={setEditVideoMode}
          seriesList={seriesList}
          academyTags={academyTags}
          closeEdit={closeEdit}
          handleEditDelete={handleEditDelete}
          handleEditSave={handleEditSave}
        />
      )}
      {/* 시리즈 추가 모달 */}
      {showNewSeries && (
        <NewSeriesModal
          newSeriesForm={newSeriesForm}
          setNewSeriesForm={setNewSeriesForm}
          newSeriesSaving={newSeriesSaving}
          setShowNewSeries={setShowNewSeries}
          handleNewSeriesSave={handleNewSeriesSave}
        />
      )}

      {/* 시리즈 수정 모달 */}
      {editingSeriesId && (
        <EditSeriesModal
          editSeriesDetail={editSeriesDetail}
          setEditSeriesDetail={setEditSeriesDetail}
          editSeriesLoading={editSeriesLoading}
          editSeriesSaving={editSeriesSaving}
          editSeriesDeleting={editSeriesDeleting}
          closeEditSeries={closeEditSeries}
          handleEditSeriesDelete={handleEditSeriesDelete}
          handleEditSeriesSave={handleEditSeriesSave}
        />
      )}
    </div>
  );
}
