'use client';
import { useState, useEffect, useMemo } from 'react';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useAttendanceStore } from '@/lib/stores/attendanceStore';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { AttendanceStatus } from '@/lib/types/attendance';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { FileDown, Send } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

const ATTITUDE_COLORS: Record<string, string> = {
  'Excellent': 'bg-[#D1FAE5] text-[#065f46]',
  'Good': 'bg-[#DBEAFE] text-[#1d4ed8]',
  'Need Effort': 'bg-[#FEF3C7] text-[#92400E]',
  'Bad': 'bg-[#FEE2E2] text-[#991B1B]',
};

const ATTITUDE_DATA = [
  { month: '2월', grade: 'Good' },
  { month: '3월', grade: 'Excellent' },
  { month: '4월', grade: 'Good' },
];

function monthStr(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getRecentMonths(n: number): { year: number; month: number; label: string }[] {
  const now = new Date();
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${d.getMonth() + 1}월` });
  }
  return result;
}

function getCurrentQuarterMonths(): { year: number; month: number; label: string }[] {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const year = now.getFullYear();
  return [0, 1, 2].map((i) => {
    const m = q * 3 + i + 1;
    return { year, month: m, label: `${m}월` };
  });
}

interface StudentReportTabProps {
  studentId: string;
}

export default function StudentReportTab({ studentId }: StudentReportTabProps) {
  const [period, setPeriod] = useState<'monthly' | 'quarterly'>('monthly');
  const { students } = useStudentStore();
  const { getRecordsByStudent, fetchByStudentMonth } = useAttendanceStore();
  const { grades, exams, fetchExams, fetchGrades } = useGradeStore();

  const student = students.find((s) => s.id === studentId);

  useEffect(() => {
    fetchExams();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exams.length > 0) {
      exams.forEach((exam) => fetchGrades(exam.id));
    }
  }, [exams.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const months = period === 'monthly' ? getRecentMonths(3) : getCurrentQuarterMonths();
    months.forEach(({ year, month }) => {
      fetchByStudentMonth(studentId, monthStr(year, month));
    });
  }, [studentId, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodMonths = useMemo(
    () => (period === 'monthly' ? getRecentMonths(3) : getCurrentQuarterMonths()),
    [period],
  );

  const absenceData = useMemo(() => {
    return periodMonths.map(({ year, month, label }) => {
      const recs = getRecordsByStudent(studentId, monthStr(year, month));
      return {
        month: label,
        결석: recs.filter((r) => r.status === AttendanceStatus.ABSENT).length,
        지각: recs.filter((r) => r.status === AttendanceStatus.LATE).length,
      };
    });
  }, [studentId, periodMonths, getRecordsByStudent]);

  const kpiRecords = useMemo(() => {
    return periodMonths.flatMap(({ year, month }) =>
      getRecordsByStudent(studentId, monthStr(year, month)),
    );
  }, [studentId, periodMonths, getRecordsByStudent]);

  const absences = kpiRecords.filter((r) => r.status === AttendanceStatus.ABSENT).length;
  const lates = kpiRecords.filter((r) => r.status === AttendanceStatus.LATE).length;
  const present = kpiRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const rate = kpiRecords.length > 0 ? Math.round((present / kpiRecords.length) * 100) : 0;

  const studentGrades = useMemo(() => {
    const startMs = new Date(periodMonths[0].year, periodMonths[0].month - 1, 1).getTime();
    const endMs = new Date(
      periodMonths[periodMonths.length - 1].year,
      periodMonths[periodMonths.length - 1].month,
      0,
    ).getTime();
    return grades
      .filter((g) => g.studentId === studentId)
      .map((g) => {
        const exam = exams.find((e) => e.id === g.examId);
        if (!exam) return null;
        const examMs = new Date(exam.date).getTime();
        if (examMs < startMs || examMs > endMs) return null;
        return {
          name: exam.name,
          shortName: exam.name.length > 8 ? exam.name.slice(0, 8) + '…' : exam.name,
          score: g.score,
          total: exam.totalScore,
          date: exam.date,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime());
  }, [studentId, grades, exams, periodMonths]);

  const avgScore = studentGrades.length > 0
    ? Math.round(studentGrades.reduce((s, g) => s + (g?.score ?? 0), 0) / studentGrades.length)
    : 0;

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = `학생 리포트 — ${student?.name ?? ''}`;
    window.print();
    document.title = prevTitle;
  };

  if (!student) return null;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={student.name} color={student.avatarColor} size="md" />
          <div>
            <div className="text-[14px] font-bold text-[#111827]">{student.name}</div>
            <div className="text-[12px] text-[#6b7280]">{student.school} {student.grade}학년</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          <div className="flex gap-2 no-print">
            <Button variant="default" size="sm" onClick={handlePrint}><FileDown size={13} /> PDF 생성</Button>
            <Button variant="dark" size="sm" onClick={() => toast('리포트가 학부모에게 발송되었습니다.', 'success')}><Send size={13} /> 학부모 발송</Button>
          </div>
        </div>
      </div>

      {/* 요약 KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '출석률', value: `${rate}%`, color: '#0D9E7A' },
          { label: '결석', value: `${absences}회`, color: '#991B1B' },
          { label: '지각', value: `${lates}회`, color: '#92400E' },
          { label: '평균 점수', value: studentGrades.length > 0 ? `${avgScore}점` : '-', color: '#4fc3a1' },
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
          <div className="text-[12.5px] font-semibold text-[#111827] mb-3">
            성적 추이 <span className="text-[11px] font-normal text-[#9ca3af]">({period === 'monthly' ? '최근 3개월' : '이번 분기'})</span>
          </div>
          {studentGrades.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={studentGrades} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortName" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#4fc3a1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-[12px] text-[#9ca3af]">
              해당 기간 성적 데이터 없음
            </div>
          )}
        </div>

        {/* 출결 추이 */}
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
          <div className="text-[12.5px] font-semibold text-[#111827] mb-3">
            출결 현황 추이 <span className="text-[11px] font-normal text-[#9ca3af]">({period === 'monthly' ? '최근 3개월' : '이번 분기'})</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={absenceData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="결석" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="지각" fill="#FDE68A" radius={[4, 4, 0, 0]} />
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
          {studentGrades.filter((g) => g && g.score !== null).length > 0 ? (
            <div className="space-y-3">
              {studentGrades.filter((g) => g && g.score !== null).slice(0, 3).map((g) => g && (
                <div key={g.name}>
                  <div className="flex justify-between gap-2 text-[12px] mb-1">
                    <span className="text-[#374151] whitespace-normal break-keep">{g.name}</span>
                    <span className="font-semibold text-[#111827] shrink-0">{g.score}점</span>
                  </div>
                  <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#4fc3a1]"
                      style={{ width: `${Math.round(((g.score as number) / g.total) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10.5px] text-[#9ca3af] mt-0.5">반 평균 대비 {(g.score as number) > 75 ? '우수' : '보통'}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#9ca3af]">해당 기간 성적 데이터 없음</p>
          )}
        </div>
      </div>
    </div>
  );
}
