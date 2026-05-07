'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { ChevronLeft, ClipboardList, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useMobileChild } from '@/contexts/MobileChildContext';

type ExamInfo = {
  id: string;
  name: string;
  subject: string;
  date: string;
  totalScore: number;
  description?: string;
  className: string;
  classSubject: string;
};

type GradeItem = {
  id: string;
  examId: string;
  score: number | null;
  rank: number | null;
  memo: string;
  exam: ExamInfo;
};

type UpcomingAssignment = {
  id: string;
  date: string;
  dueDate: string;
  memo: string;
  className: string;
  classSubject: string;
};

export default function MobileGradesPage() {
  const { selectedChildId } = useMobileChild();
  const [studentName, setStudentName] = useState('');
  const [grades, setGrades] = useState<GradeItem[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<ExamInfo[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<UpcomingAssignment[]>([]);
  const [expandedExamIds, setExpandedExamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const toggleExpandedExam = (id: string) => {
    setExpandedExamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    fetch(`/api/mobile/grades?studentId=${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setStudentName(data.studentName);
        setGrades(data.grades);
        setUpcomingExams(data.upcomingExams ?? []);
        setUpcomingAssignments(data.upcomingAssignments ?? []);
      })
      .catch(() => setError('데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  const scoredGrades = grades.filter((g) => g.score !== null);
  const avg = scoredGrades.length > 0
    ? Math.round(scoredGrades.reduce((s, g) => s + (g.score as number), 0) / scoredGrades.length)
    : 0;

  const chartData = [...grades].reverse().map((g) => ({
    name: g.exam.name.slice(0, 5),
    score: g.score,
    total: g.exam.totalScore,
  }));

  return (
    <div className="flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">리포트</span>
        </div>
        {studentName && (
          <div className="text-[12px] text-white/50 mb-3 uppercase tracking-wide font-semibold">
            {studentName} 학생
          </div>
        )}
        {error ? (
          <div className="text-[13px] text-red-400">{error}</div>
        ) : (
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[28px] font-bold text-[#4fc3a1]">{avg}점</div>
              <div className="text-[12px] text-white/60">평균 점수</div>
            </div>
            <div className="flex-1">
              <div className="text-[12px] text-white/60 mb-1">{grades.length}회 시험 응시</div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${avg}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <MobileContentLoader loading={loading}>
      <div className="px-4 py-4 space-y-3">
        {/* 다가오는 시험 */}
        {upcomingExams.length > 0 && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
            <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-1.5">
              <ClipboardList size={14} className="text-[#4fc3a1]" />
              <span className="text-[13px] font-semibold text-[#111827]">예정된 시험</span>
              <span className="text-[11px] text-[#9ca3af]">{upcomingExams.length}건</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {upcomingExams.map((e) => {
                const expanded = expandedExamIds.has(e.id);
                const hasDesc = !!e.description?.trim();
                return (
                  <div key={e.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => hasDesc && toggleExpandedExam(e.id)}
                      className={`w-full text-left ${hasDesc ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[#111827] truncate">{e.name}</div>
                          {hasDesc && (
                            expanded
                              ? <ChevronUp size={14} className="text-[#9ca3af] shrink-0" />
                              : <ChevronDown size={14} className="text-[#9ca3af] shrink-0" />
                          )}
                        </div>
                        <span className="text-[11px] text-[#4fc3a1] font-medium shrink-0 ml-2">{e.date}</span>
                      </div>
                      <div className="text-[11.5px] text-[#6b7280] mt-0.5">
                        {e.className} · 만점 {e.totalScore}점
                      </div>
                    </button>
                    {hasDesc && expanded && (
                      <div className="mt-2 px-3 py-2 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#374151] whitespace-pre-wrap leading-relaxed">
                        {e.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 다가오는 과제 */}
        {upcomingAssignments.length > 0 && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
            <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-1.5">
              <FileText size={14} className="text-[#5B4FBE]" />
              <span className="text-[13px] font-semibold text-[#111827]">과제</span>
              <span className="text-[11px] text-[#9ca3af]">{upcomingAssignments.length}건</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {upcomingAssignments.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-[#111827]">{a.className}</span>
                    <span className="text-[11px] text-[#5B4FBE] font-medium">~{a.dueDate} 까지</span>
                  </div>
                  {a.memo && (
                    <div className="text-[12px] text-[#374151] whitespace-pre-wrap leading-relaxed">{a.memo}</div>
                  )}
                  <div className="text-[10.5px] text-[#9ca3af] mt-1">출제일: {a.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 추이 차트 */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
            <div className="text-[13px] font-semibold text-[#111827] mb-3">성적 추이</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#4fc3a1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 시험 목록 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0]">
          <div className="px-4 py-3 border-b border-[#f1f5f9]">
            <span className="text-[13px] font-semibold text-[#111827]">시험 결과</span>
          </div>
          <div className="divide-y divide-[#f1f5f9]">
            {scoredGrades.map((g) => {
              const pct = Math.round(((g.score as number) / g.exam.totalScore) * 100);
              const color = pct >= 90 ? '#4fc3a1' : pct >= 70 ? '#f59e0b' : '#ef4444';
              return (
                <div key={g.id} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[13px] font-semibold text-[#111827]">{g.exam.name}</div>
                      <div className="text-[11.5px] text-[#6b7280]">
                        {g.exam.date} · {g.exam.className}
                        {g.rank != null && ` · ${g.rank}등`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-bold" style={{ color }}>
                        {g.score}<span className="text-[13px] text-[#9ca3af] font-normal">/{g.exam.totalScore}</span>
                      </div>
                      <div className="text-[11px]" style={{ color }}>{pct}%</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
            {grades.length === 0 && !error && (
              <div className="p-6 text-center text-[13px] text-[#9ca3af]">시험 기록 없음</div>
            )}
          </div>
        </div>
      </div>
      </MobileContentLoader>
      <BottomTabBar />
    </div>
  );
}
