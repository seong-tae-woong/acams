'use client';
import { type SeriesDetail } from '../_shared';

// ─── 시리즈 수정 모달 ─────────────────────────────────────────
export function EditSeriesModal({
  editSeriesDetail,
  setEditSeriesDetail,
  editSeriesLoading,
  editSeriesSaving,
  editSeriesDeleting,
  closeEditSeries,
  handleEditSeriesDelete,
  handleEditSeriesSave,
}: {
  editSeriesDetail: SeriesDetail | null;
  setEditSeriesDetail: React.Dispatch<React.SetStateAction<SeriesDetail | null>>;
  editSeriesLoading: boolean;
  editSeriesSaving: boolean;
  editSeriesDeleting: boolean;
  closeEditSeries: () => void;
  handleEditSeriesDelete: () => void;
  handleEditSeriesSave: () => void;
}) {
  return (
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
  );
}
