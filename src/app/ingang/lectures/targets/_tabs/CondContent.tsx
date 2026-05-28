'use client';
import { useState, useEffect } from 'react';
import { type Lecture } from '../_shared';
import { isYouTubeLecture, coerceExamCond } from '@/lib/lecture/source';

// ─── Tab: 이수 조건 설정 ──────────────────────────────────────
const COND_DEFAULTS = { passScore: 70, maxTries: 3, examCond: 'after100' as const, passWatchPct: 100 };

export function CondContent({ selectedLec }: { selectedLec: Lecture | null }) {
  const [passScore, setPassScore] = useState(COND_DEFAULTS.passScore);
  const [maxTries,  setMaxTries]  = useState(COND_DEFAULTS.maxTries);
  const [examCond,  setExamCond]  = useState<'after100' | 'anytime'>(COND_DEFAULTS.examCond);
  const [passWatchPct, setPassWatchPct] = useState<number>(COND_DEFAULTS.passWatchPct);

  const isYoutube = selectedLec ? isYouTubeLecture(selectedLec) : false;

  const [condLoading, setCondLoading] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  // 선택 강의의 기존 이수 조건 로드
  const lecId = selectedLec?.id;
  useEffect(() => {
    if (!lecId) return;
    let alive = true;
    setCondLoading(true);
    setSaved(false);
    fetch(`/api/ingang/quizzes/${lecId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setPassScore(d?.passScore ?? COND_DEFAULTS.passScore);
        setMaxTries(d?.maxTries ?? COND_DEFAULTS.maxTries);
        // YouTube 강의는 after100이 의미 없으므로 display 단계에서 anytime으로 강제 (server도 동일하게 coerce)
        const rawExamCond = d?.examCond === 'anytime' ? 'anytime' : 'after100';
        setExamCond(selectedLec ? coerceExamCond(selectedLec, rawExamCond) : rawExamCond);
        setPassWatchPct(
          typeof d?.passWatchPct === 'number'
            ? Math.max(50, Math.min(100, d.passWatchPct))
            : COND_DEFAULTS.passWatchPct,
        );
      })
      .catch(() => {})
      .finally(() => { if (alive) setCondLoading(false); });
    return () => { alive = false; };
  }, [lecId, selectedLec]);

  const handleReset = () => {
    setPassScore(COND_DEFAULTS.passScore);
    setMaxTries(COND_DEFAULTS.maxTries);
    setExamCond(COND_DEFAULTS.examCond);
    setPassWatchPct(COND_DEFAULTS.passWatchPct);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedLec) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ingang/quizzes/${selectedLec.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passScore, maxTries, examCond, passWatchPct }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedLec) return <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">강의를 선택해주세요</div>;

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] p-4">
        <p className="text-[13px] font-semibold text-[#1a2535] mb-4">{selectedLec.title} — 이수 조건</p>
        <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
          시험 합격 기준:
          <input type="number" value={passScore} onChange={(e) => { setPassScore(+e.target.value); setSaved(false); }}
            className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]" />
          점 이상
        </div>
        <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
          최대 응시 횟수:
          <input type="number" value={maxTries} onChange={(e) => { setMaxTries(+e.target.value); setSaved(false); }}
            className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]" />
          회
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <span className="text-[13px] text-[#374151]">시험 응시 조건:</span>
          <div className="flex gap-2">
            {(['after100','anytime'] as const).map((c) => {
              const disabled = isYoutube && c === 'after100';
              return (
                <button
                  key={c}
                  onClick={() => { if (disabled) return; setExamCond(c); setSaved(false); }}
                  disabled={disabled}
                  title={disabled ? 'YouTube 강의는 시청률 검증이 불가하여 "바로 응시"만 선택할 수 있습니다.' : undefined}
                  className="text-[12px] px-3 py-1.5 rounded-[8px] border-[1.5px] font-medium disabled:cursor-not-allowed"
                  style={
                    disabled
                      ? { background: '#f3f4f6', color: '#c4c4c4', borderColor: '#e2e8f0' }
                      : examCond === c
                        ? { background: '#EEEDFE', color: '#534AB7', borderColor: '#a78bfa' }
                        : { background: '#fff', color: '#6b7280', borderColor: '#e2e8f0' }
                  }
                >
                  {c === 'after100' ? `영상 ${passWatchPct}% 시청 후 응시 가능` : '바로 응시 가능'}
                </button>
              );
            })}
          </div>
          {isYoutube && (
            <p className="text-[11px] text-[#9ca3af] mt-1">
              💡 YouTube 강의는 시청률 추적이 불가하여 &lsquo;바로 응시&rsquo;만 가능합니다.
            </p>
          )}
        </div>
        {examCond === 'after100' && (
          <div className="flex items-center gap-3 mb-3.5 text-[13px] text-[#374151]">
            이수 인정 시청률:
            <input
              type="number"
              min={50}
              max={100}
              value={passWatchPct}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setPassWatchPct(Math.max(50, Math.min(100, Math.round(n))));
                setSaved(false);
              }}
              className="w-20 text-[14px] font-semibold text-center px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-[8px] bg-[#f9fafb] outline-none focus:border-[#a78bfa]"
            />
            % 이상 (50~100)
          </div>
        )}
        <p className="text-[12px] text-[#9ca3af] bg-[#f9fafb] rounded-[8px] px-3 py-2.5 leading-relaxed">
          {examCond === 'after100'
            ? `영상 ${passWatchPct}% 이상 시청 후, 합격 기준 ${passScore}점 이상, 최대 ${maxTries}회 응시 가능. ${maxTries}회 모두 불합격 시 원장/강사의 재응시 허용이 필요합니다.`
            : `시청률 무관, 합격 기준 ${passScore}점 이상, 최대 ${maxTries}회 응시 가능. ${maxTries}회 모두 불합격 시 원장/강사의 재응시 허용이 필요합니다.`}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={handleReset}
          disabled={saving || condLoading}
          className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] border border-[#e2e8f0] bg-white text-[#374151] font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          초기화
        </button>
        <button
          onClick={handleSave}
          disabled={saving || condLoading}
          className="px-3.5 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white disabled:opacity-60 transition-colors"
          style={{ background: saved ? '#059669' : '#5B4FBE' }}
        >
          {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
        </button>
      </div>
    </div>
  );
}
