'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useAttendanceStore } from '@/lib/stores/attendanceStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { AttendanceStatus } from '@/lib/types/attendance';
import { StudentStatus } from '@/lib/types/student';
import { formatKoreanDate } from '@/lib/utils/format';
import clsx from 'clsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { FileDown, Send } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

const ATTITUDE_COLORS: Record<string, string> = {
  'Excellent': 'bg-[#D1FAE5] text-[#065f46]',
  'Good': 'bg-[#DBEAFE] text-[#1d4ed8]',
  'Need Effort': 'bg-[#FEF3C7] text-[#92400E]',
  'Bad': 'bg-[#FEE2E2] text-[#991B1B]',
};

// 더미 태도 평가 데이터
const ATTITUDE_DATA = [
  { month: '2월', grade: 'Good' },
  { month: '3월', grade: 'Excellent' },
  { month: '4월', grade: 'Good' },
];

export default function StudentReportPage() {
  const [period, setPeriod] = useState<'monthly' | 'quarterly'>('monthly');
  const { students, selectedStudentId, setSelectedStudent } = useStudentStore();
  const { getRecordsByStudent } = useAttendanceStore();
  const { grades, exams } = useGradeStore();

  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);
  const selected = students.find((s) => s.id === selectedStudentId) ?? activeStudents[0];

  // 성적 추이 데이터
  const studentGrades = selected
    ? grades.filter((g) => g.studentId === selected.id).map((g) => {
        const exam = exams.find((e) => e.id === g.examId);
        return exam ? { name: exam.name.slice(0, 6), score: g.score, total: exam.totalScore } : null;
      }).filter(Boolean)
    : [];

  // 출결 통계 (4월)
  const attRecords = selected ? getRecordsByStudent(selected.id, '2026-04') : [];
  const absences = attRecords.filter((r) => r.status === AttendanceStatus.ABSENT).length;
  const lates = attRecords.filter((r) => r.status === AttendanceStatus.LATE).length;
  const present = attRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const total = attRecords.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const absenceData = [
    { month: '2월', 결석: 1, 지각: 2 },
    { month: '3월', 결석: 0, 지각: 1 },
    { month: '4월', 결석: absences, 지각: lates },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="학생 리포트"
        badge="성적·태도·결석 종합"
        actions={
          <>
            <Button variant="default" size="sm" onClick={() => toast('PDF 생성 기능은 추후 지원 예정입니다.', 'info')}><FileDown size={13} /> PDF 생성</Button>
            <Button variant="dark" size="sm" onClick={() => toast('리포트가 학부모에게 발송되었습니다.', 'success')}><Send size={13} /> 학부모 발송</Button>
          </>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 학생 목록 */}
        <div className="w-44 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {activeStudents.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStudent(s.id)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2.5 border-b border-[#f1f5f9] text-left cursor-pointer transition-colors',
                selected?.id === s.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
              )}
            >
              <Avatar name={s.name} color={s.avatarColor} size="sm" />
              <span className="text-[12.5px] font-medium text-[#111827]">{s.name}</span>
            </button>
          ))}
        </div>

        {/* 리포트 본문 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {selected && (
            <>
              {/* 헤더 */}
              <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.name} color={selected.avatarColor} size="md" />
                  <div>
                    <div className="text-[14px] font-bold text-[#111827]">{selected.name}</div>
                    <div className="text-[12px] text-[#6b7280]">{selected.school} {selected.grade}학년</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(['monthly', 'quarterly'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={clsx(
                        'px-3 py-1 rounded-[20px] text-[11.5px] font-medium cursor-pointer transition-colors',
                        period === p ? 'bg-[#1a2535] text-white' : 'bg-[#f1f5f9] text-[#6b7280] hover:bg-[#e2e8f0]',
                      )}
                    >
                      {p === 'monthly' ? '월별' : '분기별'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 요약 KPI */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '출석률', value: `${rate}%`, color: '#0D9E7A' },
                  { label: '결석', value: `${absences}회`, color: '#991B1B' },
                  { label: '지각', value: `${lates}회`, color: '#92400E' },
                  { label: '평균 점수', value: studentGrades.length > 0 ? `${Math.round(studentGrades.reduce((s, g) => s + (g?.score ?? 0), 0) / studentGrades.length)}점` : '-', color: '#4fc3a1' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 text-center">
                    <div className="text-[20px] font-bold" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="text-[11.5px] text-[#6b7280] mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 성적 추이 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">성적 추이</div>
                  {studentGrades.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={studentGrades} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="score" stroke="#4fc3a1" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-[12px] text-[#9ca3af]">성적 데이터 없음</div>
                  )}
                </div>

                {/* 결석/지각 추이 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">출결 현황 추이</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={absenceData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="결석" fill="#FEE2E2" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="지각" fill="#FEF3C7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 태도 평가 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">태도 평가 추이</div>
                  <div className="space-y-2">
                    {ATTITUDE_DATA.map((item) => (
                      <div key={item.month} className="flex items-center justify-between">
                        <span className="text-[12px] text-[#6b7280]">{item.month}</span>
                        <span className={clsx('px-2.5 py-0.5 rounded-[20px] text-[11px] font-medium', ATTITUDE_COLORS[item.grade])}>
                          {item.grade}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#9ca3af] mt-3">* 태도 평가는 수업별 출결 체크 시 강사가 입력합니다.</p>
                </div>

                {/* 상대 비교 */}
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">반 내 상대 비교</div>
                  <div className="space-y-3">
                    {studentGrades.slice(0, 2).map((g) => g && (
                      <div key={g.name}>
                        <div className="flex justify-between text-[12px] mb-1">
                          <span className="text-[#374151]">{g.name}</span>
                          <span className="font-semibold text-[#111827]">{g.score}점</span>
                        </div>
                        <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#4fc3a1]"
                            style={{ width: `${Math.round((g.score / g.total) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[10.5px] text-[#9ca3af] mt-0.5">반 평균 대비 {g.score > 75 ? '우수' : '보통'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
