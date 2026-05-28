'use client';
import { VideoUpload } from '@/components/ingang/VideoUpload';
import { type LectureDetail, type AcademyTag, type Series } from '../_shared';

// ─── 강의 수정 모달 ───────────────────────────────────────────
export function EditLectureModal({
  editDetail,
  setEditDetail,
  editLoading,
  editSaving,
  editDeleting,
  editVideoMode,
  setEditVideoMode,
  seriesList,
  academyTags,
  closeEdit,
  handleEditDelete,
  handleEditSave,
}: {
  editDetail: LectureDetail | null;
  setEditDetail: React.Dispatch<React.SetStateAction<LectureDetail | null>>;
  editLoading: boolean;
  editSaving: boolean;
  editDeleting: boolean;
  editVideoMode: 'youtube' | 'cloudflare';
  setEditVideoMode: (m: 'youtube' | 'cloudflare') => void;
  seriesList: Series[];
  academyTags: AcademyTag[];
  closeEdit: () => void;
  handleEditDelete: () => void;
  handleEditSave: () => void;
}) {
  return (
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

            {/* 영상 등록 — YouTube URL / 직접 업로드 선택 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-semibold text-[#374151]">영상 등록</label>
                <div className="flex rounded-[8px] overflow-hidden border border-[#e2e8f0] text-[11.5px] font-medium">
                  <button
                    onClick={() => {
                      setEditVideoMode('youtube');
                      // YouTube 모드로 전환 시 cfVideoId clear (predicate가 cfVideoId 우선이라 이 정리가 없으면 강의가 Cloudflare로 잘못 분류됨)
                      setEditDetail((prev) => (prev ? { ...prev, cfVideoId: null } : prev));
                    }}
                    className="px-3 py-1 transition-colors"
                    style={editVideoMode === 'youtube'
                      ? { background: '#5B4FBE', color: '#fff' }
                      : { background: '#fff', color: '#6b7280' }}
                  >
                    YouTube URL
                  </button>
                  <button
                    onClick={() => {
                      setEditVideoMode('cloudflare');
                      // Cloudflare 모드로 전환 시 videoUrl clear (두 필드 공존 방지)
                      setEditDetail((prev) => (prev ? { ...prev, videoUrl: null } : prev));
                    }}
                    className="px-3 py-1 border-l border-[#e2e8f0] transition-colors"
                    style={editVideoMode === 'cloudflare'
                      ? { background: '#5B4FBE', color: '#fff' }
                      : { background: '#fff', color: '#6b7280' }}
                  >
                    직접 업로드
                  </button>
                </div>
              </div>

              {editVideoMode === 'youtube' ? (
                <>
                  <input
                    value={editDetail.videoUrl ?? ''}
                    onChange={(e) => setEditDetail({ ...editDetail, videoUrl: e.target.value || null })}
                    placeholder="https://www.youtube.com/embed/..."
                    className="w-full text-[13px] px-3 py-2 border border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa] focus:bg-white"
                  />
                  <p className="text-[11px] text-[#9ca3af] mt-1">YouTube 영상 페이지 → 공유 → 퍼가기에서 Embed URL을 확인할 수 있습니다.</p>
                </>
              ) : editDetail.cfVideoId ? (
                <div className="border border-[#e2e8f0] rounded-[10px] px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
                    <span style={{ borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '11px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#111827]">업로드된 영상</p>
                    <p className="text-[11px] text-[#9ca3af] truncate">Cloudflare Stream · {editDetail.cfVideoId}</p>
                  </div>
                  <button
                    onClick={() => setEditDetail({ ...editDetail, cfVideoId: null })}
                    className="text-[11px] text-[#9ca3af] hover:text-[#ef4444] shrink-0"
                  >
                    교체
                  </button>
                </div>
              ) : (
                <VideoUpload onComplete={(uid) => setEditDetail((prev) => prev ? { ...prev, cfVideoId: uid } : prev)} />
              )}
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
  );
}
