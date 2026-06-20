import type { LevelTestReportData } from '@/lib/levelTest/types';

const clamp = (v: number) => Math.min(100, Math.max(0, v));

// 레벨 테스트 객관 점수형 리포트 본문 — 원장 미리보기·학부모 PWA 공용(동일 렌더).
export default function LevelTestReportView({ data }: { data: LevelTestReportData }) {
  return (
    <>
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[40px] font-bold text-[#111827] leading-none tabular-nums">{data.totalScore}</span>
          <span className="text-[14px] text-[#6b7280]">/ 100점</span>
          {data.totalAverage != null && (
            <span className="ml-auto text-[12px] font-medium text-[#374151] bg-[#f4f6f8] px-2.5 py-1.5 rounded-[8px] tabular-nums">
              {data.averageLabel} {data.totalAverage}점
            </span>
          )}
        </div>
      </div>
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 space-y-3">
        <div className="text-[13px] font-semibold text-[#111827]">유형별 강약</div>
        {data.sections.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] text-[#111827]">{s.name}</span>
              <span className="text-[12px] text-[#6b7280] tabular-nums">
                <span className="text-[#111827] font-medium">{s.score}점</span>
                {s.average != null && <> · 평균 {s.average}</>}
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
      </div>
      {data.comment && data.comment.trim() && (
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="text-[13px] font-semibold text-[#111827] mb-1.5">선생님 코멘트</div>
          <div className="text-[13px] text-[#374151] whitespace-pre-wrap leading-relaxed">{data.comment}</div>
        </div>
      )}
    </>
  );
}
