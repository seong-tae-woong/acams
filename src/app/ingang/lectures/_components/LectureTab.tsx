'use client';
import { type Lecture } from '../_shared';

// ─── 강의별 탭 (시리즈 소속·단독 강의 통합 평면 목록) ──────────
export function LectureTab({
  visibleLectures,
  filteredLectures,
  hasMore,
  seriesTitleOfLec,
  openEdit,
}: {
  visibleLectures: Lecture[];
  filteredLectures: Lecture[];
  hasMore: boolean;
  seriesTitleOfLec: (l: Lecture) => string;
  openEdit: (id: string) => void;
}) {
  return (
    <>
      {/* ── 강의별 탭 (시리즈 소속·단독 강의 통합 평면 목록) ── */}
      {visibleLectures.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-3.5">
            {visibleLectures.map((lec) => {
              const seriesTitle = seriesTitleOfLec(lec);
              return (
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
                    {/* 소속 시리즈 표시 (단독 강의는 표시 없음) */}
                    {seriesTitle ? (
                      <p className="text-[10.5px] text-[#7c3aed] font-medium mb-1 truncate">
                        {seriesTitle}{lec.episodeNumber ? ` · ${lec.episodeNumber}강` : ''}
                      </p>
                    ) : (
                      <p className="text-[10.5px] text-[#9ca3af] font-medium mb-1">단독 강의</p>
                    )}
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
              );
            })}
          </div>
        </section>
      )}

      {/* 무한 스크롤 안내 */}
      {hasMore && (
        <p className="text-center text-[12px] text-[#9ca3af] py-2">
          스크롤하여 더 보기 ({visibleLectures.length}/{filteredLectures.length})
        </p>
      )}
    </>
  );
}
