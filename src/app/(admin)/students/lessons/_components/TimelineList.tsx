'use client';
import { Check, X as XIcon } from 'lucide-react';
import clsx from 'clsx';
import { ATTITUDE_LABELS } from '@/lib/types/lesson';
import type { StudentLessonTimelineEntry, AttendanceUiStatus } from '@/lib/types/lesson';

interface TimelineListProps {
  timeline: StudentLessonTimelineEntry[];
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} (${DAY_LABELS[d.getDay()]})`;
}

const ATT_STYLE: Record<AttendanceUiStatus, string> = {
  출석: 'bg-[#E1F5EE] text-[#065f46]',
  지각: 'bg-[#FEF3C7] text-[#92400e]',
  결석: 'bg-[#FEE2E2] text-[#b91c1c]',
  조퇴: 'bg-[#F3F4F6] text-[#374151]',
};

function AttitudeChip({ score }: { score: number }) {
  const tier =
    score >= 4 ? 'bg-[#4fc3a1] text-white' : score === 3 ? 'bg-[#e2e8f0] text-[#374151]' : 'bg-[#FCA5A5] text-[#7f1d1d]';
  return (
    <span
      title={ATTITUDE_LABELS[score]}
      className={clsx('inline-flex items-center justify-center w-6 h-6 rounded-[7px] text-[12px] font-bold', tier)}
    >
      {score}
    </span>
  );
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
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e2e8f0] text-[12.5px] font-semibold text-[#111827]">
        수업 세션 <span className="text-[11px] font-normal text-[#9ca3af]">{timeline.length}회</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#f9fafb] text-[#6b7280] text-[11px]">
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">날짜</th>
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">반</th>
              <th className="text-center font-medium px-3 py-2 whitespace-nowrap">출석</th>
              <th className="text-center font-medium px-3 py-2 whitespace-nowrap">태도</th>
              <th className="text-center font-medium px-3 py-2 whitespace-nowrap">과제</th>
              <th className="text-left font-medium px-3 py-2 min-w-[200px]">수업 내용</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((e, idx) => {
              const isMakeup = e.kind === 'makeup';
              return (
                <tr
                  key={`${isMakeup ? 'm' : 'r'}-${e.makeupClassId ?? e.classId}-${e.date}-${idx}`}
                  className="border-t border-[#f1f5f9] align-top"
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[#111827] tabular-nums">{fmtDate(e.date)}</span>
                      {isMakeup && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e]">보강</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.classColor }} />
                      <span className="text-[#374151]">{e.className}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {e.attendanceStatus ? (
                      <span className={clsx('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full', ATT_STYLE[e.attendanceStatus])}>
                        {e.attendanceStatus}
                      </span>
                    ) : (
                      <span className="text-[#d1d5db]">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {e.attitude ? <AttitudeChip score={e.attitude} /> : <span className="text-[#d1d5db]">–</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {e.homeworkDone === true ? (
                      <Check size={15} className="inline text-[#4fc3a1]" />
                    ) : e.homeworkDone === false ? (
                      <XIcon size={15} className="inline text-[#ef4444]" />
                    ) : (
                      <span className="text-[#d1d5db]">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.sessionNote ? (
                      <span className="text-[#374151] whitespace-pre-wrap">{e.sessionNote}</span>
                    ) : isMakeup && e.makeupReason ? (
                      <span className="text-[#9ca3af]">보강 · {e.makeupReason}</span>
                    ) : (
                      <span className="text-[#d1d5db]">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
