'use client';
import { useState, useEffect } from 'react';
import { type Lecture, type Series, lectureTags, episodesOf } from '../_shared';

// ─── Tab: 시리즈 구성 ──────────────────────────────────────────
export function SeriesContent({ lectures, loading, onLecturesChange }: {
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

  useEffect(() => {
    if (!selectedId && seriesList.length > 0) setSelectedId(seriesList[0].id);
  }, [seriesList, selectedId]);

  const selectedSeries = seriesList.find((s) => s.id === selectedId) ?? null;
  const episodes = selectedSeries ? episodesOf(lectures, selectedSeries.id) : [];

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
              const count  = episodesOf(lectures, s.id).length;
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
