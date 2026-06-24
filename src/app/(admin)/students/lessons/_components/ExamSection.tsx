'use client';
import type { StudentLessonExam } from '@/lib/types/lesson';

function fmt(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default function ExamSection({ exams }: { exams: StudentLessonExam[] }) {
  if (exams.length === 0) return null;
  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e2e8f0] text-[12.5px] font-semibold text-[#111827]">
        시험 점수 <span className="text-[11px] font-normal text-[#9ca3af]">{exams.length}회</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#f9fafb] text-[#6b7280] text-[11px]">
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">날짜</th>
              <th className="text-left font-medium px-3 py-2 min-w-[140px]">시험</th>
              <th className="text-left font-medium px-3 py-2 whitespace-nowrap">과목</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">점수</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">등수</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((ex) => {
              const pct = ex.totalScore > 0 ? Math.round((ex.score / ex.totalScore) * 100) : null;
              return (
                <tr key={ex.id} className="border-t border-[#f1f5f9]">
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#111827] tabular-nums">{fmt(ex.date)}</td>
                  <td className="px-3 py-2.5 text-[#374151]">{ex.name}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#6b7280]">{ex.subject}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="font-semibold text-[#111827] tabular-nums">{ex.score}</span>
                    <span className="text-[#9ca3af]">
                      {' '}/ {ex.totalScore}
                      {pct != null ? ` (${pct}%)` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-[#374151] tabular-nums">
                    {ex.rank != null ? `${ex.rank}등` : '–'}
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
