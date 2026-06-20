import type { LevelTestReportData } from '@/lib/levelTest/types';
import { showPlacement } from '@/lib/levelTest/report';

const clamp = (v: number) => Math.min(100, Math.max(0, v));

// 레벨 테스트 객관 점수형 리포트 본문 — 원장 미리보기·학부모 PWA 공용(동일 렌더). 설계 §Q.
// 위계: 배치(내러티브 리드) → 종합 점수(보조 강등) → 유형별 강약(근거, read 태그 없음) → 코멘트.
export default function LevelTestReportView({ data }: { data: LevelTestReportData }) {
  const hasAverage = data.sections.some((s) => s.average != null);
  const place = data.placement;
  return (
    <>
      {/* 배치 결과 — 내러티브 리드. 레거시 리포트(placement 없음)면 숨김(§Q·3B) */}
      {showPlacement(data) && place && (
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[11px] text-[#9ca3af] mb-1.5">배치</div>
          {data.narrative && (
            <div className="text-[15px] font-medium text-[#111827] leading-relaxed mb-2">{data.narrative}</div>
          )}
          <div className="text-[11px] text-[#6b7280]">
            <span className="text-[#0F6E56] font-medium">{place.bandLabel}</span>
            {place.recommendClass ? ` · ${place.recommendClass}` : ''}
            {place.ladder.length > 0 ? ` · 전체 ${place.ladder.length}단계 중` : ''}
          </div>
        </div>
      )}

      {/* 종합 점수 — 보조로 차분하게(배치가 결론) */}
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-3.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-[#9ca3af]">종합</span>
          <span className="text-[20px] font-bold text-[#111827] leading-none tabular-nums">{data.totalScore}</span>
          <span className="text-[12px] text-[#6b7280]">/ 100점</span>
          {data.totalAverage != null && (
            <span className="ml-auto text-[11px] text-[#6b7280] tabular-nums">
              {data.averageLabel} {data.totalAverage}
            </span>
          )}
        </div>
      </div>

      {/* 유형별 강약 — 근거 (강함/보통/보강 태그 미렌더, §Q D2) */}
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 space-y-3">
        <div className="text-[13px] font-semibold text-[#111827]">유형별 강약</div>
        {data.sections.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] text-[#111827]">{s.name}</span>
              <span className="text-[12px] text-[#6b7280] tabular-nums">
                {s.correct != null && s.total != null && (
                  <span className="text-[#6b7280]">
                    {s.correct}/{s.total} ·{' '}
                  </span>
                )}
                <span className="text-[#111827] font-medium">{s.score}</span>
              </span>
            </div>
            <div className="relative h-2 bg-[#f1f5f9] rounded-full">
              <div className="h-full bg-[#1D9E75] rounded-full" style={{ width: `${clamp(s.score)}%` }} />
              {s.average != null && (
                <div className="absolute -top-0.5 h-3 w-px bg-[#9ca3af]" style={{ left: `${clamp(s.average)}%` }} />
              )}
            </div>
          </div>
        ))}
        {hasAverage && <div className="text-[10px] text-[#9ca3af] text-right pt-0.5">┃ = {data.averageLabel}</div>}
      </div>

      {/* 선생님 코멘트 */}
      {data.comment && data.comment.trim() && (
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[13px] font-semibold text-[#111827] mb-1.5">선생님 코멘트</div>
          <div className="text-[13px] text-[#374151] whitespace-pre-wrap leading-relaxed">{data.comment}</div>
        </div>
      )}
    </>
  );
}
