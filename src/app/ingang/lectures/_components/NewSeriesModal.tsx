'use client';

// ─── 시리즈 추가 모달 ─────────────────────────────────────────
export function NewSeriesModal({
  newSeriesForm,
  setNewSeriesForm,
  newSeriesSaving,
  setShowNewSeries,
  handleNewSeriesSave,
}: {
  newSeriesForm: { title: string; description: string; status: 'DRAFT' | 'PUBLISHED' };
  setNewSeriesForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; status: 'DRAFT' | 'PUBLISHED' }>>;
  newSeriesSaving: boolean;
  setShowNewSeries: (v: boolean) => void;
  handleNewSeriesSave: () => void;
}) {
  return (
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
  );
}
