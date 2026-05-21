'use client';
import type { StudentLessonHistory } from '@/lib/types/lesson';

interface SummaryCardProps {
  data: StudentLessonHistory;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function SummaryCard({ data }: SummaryCardProps) {
  const { student, range, summary } = data;

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[14px] font-semibold text-[#111827]">{student.name}</span>
        <span className="text-[12px] text-[#6b7280]">
          {formatDate(range.from)} ~ {formatDate(range.to)}
        </span>
      </div>

      <div className="text-[12.5px] text-[#374151]">
        코멘트 작성된 수업: <span className="font-semibold text-[#111827]">{summary.commentCount}회</span>
      </div>

      {summary.clinicByTemplate.length === 0 ? (
        <div className="text-[12px] text-[#9ca3af]">기간 내 Clinic 결과 없음</div>
      ) : (
        <div className="space-y-2">
          <div className="text-[12px] font-semibold text-[#111827]">Clinic 체크율</div>
          <div className="space-y-2">
            {summary.clinicByTemplate.map((tmpl) => (
              <div key={tmpl.templateId} className="border border-[#f1f5f9] rounded-[8px] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12.5px] font-medium text-[#111827]">{tmpl.templateName}</span>
                  {!tmpl.isActive && (
                    <span className="text-[10.5px] text-[#9ca3af]">(삭제됨)</span>
                  )}
                </div>
                {tmpl.itemRates.length === 0 ? (
                  <div className="text-[11.5px] text-[#9ca3af]">항목 결과 없음</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {tmpl.itemRates.map((it) => {
                      const pct = Math.round(it.rate * 100);
                      return (
                        <div key={it.itemId} className="flex flex-col gap-1">
                          <div className="flex justify-between text-[11.5px]">
                            <span className="text-[#374151] truncate">{it.label}</span>
                            <span className="text-[#111827] font-semibold tabular-nums">
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#4fc3a1] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[10.5px] text-[#9ca3af]">
                            {it.checked}/{it.total}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
