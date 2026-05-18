'use client';
import { useEffect } from 'react';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import type { Student } from '@/lib/types/student';
import { formatKoreanDate } from '@/lib/utils/format';

export default function GradeTab({ student }: { student: Student }) {
  const { classes } = useClassStore();
  const { getExamsByClass, getGradesByExam, fetchExams, fetchGrades } = useGradeStore();

  const studentClasses = classes.filter((c) => student.classes.includes(c.id));
  const classIdsKey = studentClasses.map((c) => c.id).join(',');

  // 학생 수강 반의 시험·성적 로드
  // fetchExams는 append 옵션이 없으면 store.exams를 통째로 교체한다.
  // 여러 반의 시험을 한 화면에서 함께 봐야 하므로 — 첫 반은 교체, 나머지는 누적(append)으로
  // 순차 호출한다. (병렬 호출 시 마지막 응답이 앞 반의 시험을 덮어쓰는 경합 발생)
  useEffect(() => {
    let alive = true;
    (async () => {
      for (let i = 0; i < studentClasses.length; i++) {
        const cls = studentClasses[i];
        await fetchExams(cls.id, i === 0 ? undefined : { append: true });
        if (!alive) return;
        getExamsByClass(cls.id).forEach((exam) => fetchGrades(exam.id));
      }
    })();
    return () => { alive = false; };
  }, [classIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradeRows = studentClasses.flatMap((cls) =>
    getExamsByClass(cls.id).map((exam) => {
      const grades = getGradesByExam(exam.id);
      const myGrade = grades.find((g) => g.studentId === student.id);
      return { cls, exam, myGrade: myGrade ?? null };
    }),
  ).sort((a, b) => b.exam.date.localeCompare(a.exam.date));

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e2e8f0]">
        <span className="text-[12.5px] font-semibold text-[#111827]">시험 성적 내역</span>
      </div>
      {gradeRows.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-[#9ca3af]">시험 기록이 없습니다.</div>
      ) : (
        <table className="w-full text-[12.5px]">
          <thead className="bg-[#f4f6f8]">
            <tr>
              {['반', '시험명', '날짜', '점수', '만점', '비고'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11.5px] text-[#6b7280] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {gradeRows.map(({ cls, exam, myGrade }) => (
              <tr key={exam.id} className="hover:bg-[#f9fafb]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                    <span className="text-[#111827]">{cls.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[#111827] font-medium">{exam.name}</td>
                <td className="px-4 py-2.5 text-[#6b7280]">{formatKoreanDate(exam.date)}</td>
                <td className="px-4 py-2.5">
                  {myGrade?.score != null ? (
                    <span className="font-bold text-[#111827]">{myGrade.score}</span>
                  ) : (
                    <span className="text-[#9ca3af]">미기록</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#6b7280]">{exam.totalScore}</td>
                <td className="px-4 py-2.5 text-[#9ca3af]">{myGrade?.memo || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
