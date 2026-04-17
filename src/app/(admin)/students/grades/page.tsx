'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { useClassStore } from '@/lib/stores/classStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { formatKoreanDate } from '@/lib/utils/format';
import { Plus } from 'lucide-react';
import clsx from 'clsx';

export default function GradesPage() {
  const { classes } = useClassStore();
  const { exams, grades, selectedExamId, getExamsByClass, getGradesByExam, setSelectedExam } = useGradeStore();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? '');

  const classExams = getExamsByClass(selectedClassId);
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const examGrades = selectedExamId ? getGradesByExam(selectedExamId) : [];

  const avg = examGrades.length > 0
    ? Math.round(examGrades.reduce((s, g) => s + g.score, 0) / examGrades.length)
    : 0;
  const max = examGrades.length > 0 ? Math.max(...examGrades.map(g => g.score)) : 0;
  const min = examGrades.length > 0 ? Math.min(...examGrades.map(g => g.score)) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="성적/시험 결과 관리"
        actions={<Button variant="dark" size="sm"><Plus size={13} /> 시험 등록</Button>}
      />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 반 선택 */}
        <div className="flex gap-2">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => { setSelectedClassId(cls.id); setSelectedExam(null); }}
              className={clsx(
                'px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium border transition-colors cursor-pointer',
                selectedClassId === cls.id
                  ? 'text-white border-transparent'
                  : 'text-[#374151] border-[#e2e8f0] bg-white hover:bg-[#f4f6f8]',
              )}
              style={selectedClassId === cls.id ? { backgroundColor: cls.color } : {}}
            >
              {cls.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[260px_1fr] gap-4">
          {/* 시험 목록 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0]">
              <span className="text-[12.5px] font-semibold text-[#111827]">시험 목록</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {classExams.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-[#9ca3af]">시험 없음</div>
              ) : classExams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExam(exam.id)}
                  className={clsx(
                    'w-full px-4 py-3 text-left transition-colors cursor-pointer',
                    selectedExamId === exam.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <div className="text-[13px] font-medium text-[#111827]">{exam.name}</div>
                  <div className="text-[11.5px] text-[#6b7280] mt-0.5">
                    {formatKoreanDate(exam.date)} · 만점 {exam.totalScore}점
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 성적 상세 */}
          {selectedExam ? (
            <div className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '응시 인원', value: `${examGrades.length}명` },
                  { label: '평균', value: `${avg}점` },
                  { label: '최고', value: `${max}점` },
                  { label: '최저', value: `${min}점` },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                    <div className="text-[20px] font-bold text-[#111827]">{s.value}</div>
                    <div className="text-[11.5px] text-[#6b7280] mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* 성적 테이블 */}
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[#111827]">학생별 성적</span>
                  <Button variant="default" size="sm">성적 입력</Button>
                </div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f4f6f8]">
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">이름</th>
                      <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">점수</th>
                      <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">순위</th>
                      <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">점수 비율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {examGrades
                      .sort((a, b) => b.score - a.score)
                      .map((g) => {
                        const pct = Math.round((g.score / selectedExam.totalScore) * 100);
                        return (
                          <tr key={g.id} className="hover:bg-[#f4f6f8]">
                            <td className="px-4 py-2.5 text-[#111827]">{g.studentName}</td>
                            <td className="px-4 py-2.5 text-center font-semibold text-[#111827]">
                              {g.score}<span className="text-[#9ca3af] font-normal">/{selectedExam.totalScore}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center text-[#374151]">{g.rank}위</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: pct >= 90 ? '#4fc3a1' : pct >= 70 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                                <span className="text-[11.5px] text-[#6b7280] w-8 text-right">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] flex items-center justify-center h-48">
              <p className="text-[13px] text-[#9ca3af]">좌측에서 시험을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
