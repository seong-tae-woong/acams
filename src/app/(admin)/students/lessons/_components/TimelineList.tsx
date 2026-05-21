'use client';
import { Check, X as XIcon } from 'lucide-react';
import type { StudentLessonTimelineEntry } from '@/lib/types/lesson';

interface TimelineListProps {
  timeline: StudentLessonTimelineEntry[];
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const dow = DAY_LABELS[d.getDay()];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (${dow})`;
}

export default function TimelineList({ timeline }: TimelineListProps) {
  if (timeline.length === 0) {
    return (
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-8 text-center">
        <div className="text-[13px] text-[#6b7280]">선택한 기간에 수업 이력이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {timeline.map((entry, idx) => (
        <div
          key={`${entry.classId}-${entry.date}-${idx}`}
          className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden flex"
        >
          <div className="w-1 shrink-0" style={{ backgroundColor: entry.classColor }} />
          <div className="flex-1 p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[12.5px] font-semibold text-[#111827]">{formatHeader(entry.date)}</span>
              <span className="text-[12px] text-[#374151]">{entry.className}</span>
              {entry.startTime && (
                <span className="text-[11.5px] text-[#6b7280]">
                  {entry.startTime}~{entry.endTime}
                </span>
              )}
              {entry.isOneTime && (
                <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e]">
                  보강
                </span>
              )}
            </div>

            {entry.comment && entry.comment.trim() !== '' ? (
              <div className="text-[12.5px] text-[#374151] leading-relaxed whitespace-pre-wrap">
                {entry.comment}
              </div>
            ) : (
              <div className="text-[11.5px] text-[#9ca3af]">코멘트 없음</div>
            )}

            {entry.clinics.length > 0 && (
              <div className="space-y-2">
                {entry.clinics.map((clinic) => (
                  <div key={clinic.templateId} className="border border-[#f1f5f9] rounded-[8px] p-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[11.5px] font-semibold text-[#374151]">
                        {clinic.templateName}
                      </span>
                      {!clinic.isActive && (
                        <span className="text-[10px] text-[#9ca3af]">(삭제됨)</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {clinic.checks.map((c) => (
                        <div key={c.itemId} className="flex items-center gap-1 text-[11.5px]">
                          {c.checked ? (
                            <Check size={12} className="text-[#4fc3a1]" />
                          ) : (
                            <XIcon size={12} className="text-[#d1d5db]" />
                          )}
                          <span className={c.checked ? 'text-[#111827]' : 'text-[#9ca3af]'}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
