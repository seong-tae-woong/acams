'use client';
import { type Lecture, type Series } from '../_shared';

// ─── 시리즈별 탭 (시리즈 카드 + 펼침 시 에피소드 목록) ──────────
export function SeriesTab({
  visibleSeries,
  filteredSeries,
  hasMore,
  expandedId,
  setExpandedId,
  episodesOf,
  seriesSubjects,
  openEditSeries,
  openEdit,
}: {
  visibleSeries: Series[];
  filteredSeries: Series[];
  hasMore: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  episodesOf: (seriesId: string) => Lecture[];
  seriesSubjects: (seriesId: string) => string[];
  openEditSeries: (id: string) => void;
  openEdit: (id: string) => void;
}) {
  return (
    <>
      {/* ── 시리즈별 탭 ───────────────────────────── */}
      {visibleSeries.length > 0 && (
        <section className="flex flex-col gap-2.5">
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
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* 무한 스크롤 안내 */}
      {hasMore && (
        <p className="text-center text-[12px] text-[#9ca3af] py-2">
          스크롤하여 더 보기 ({visibleSeries.length}/{filteredSeries.length})
        </p>
      )}
    </>
  );
}
