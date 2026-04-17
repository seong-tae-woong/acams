'use client';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import { useGradeStore } from '@/lib/stores/gradeStore';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const STUDENT_ID = 's1';

export default function MobileGradesPage() {
  const { grades, exams } = useGradeStore();

  const myGrades = grades
    .filter((g) => g.studentId === STUDENT_ID)
    .map((g) => {
      const exam = exams.find((e) => e.id === g.examId);
      return { ...g, exam };
    })
    .filter((g) => g.exam)
    .sort((a, b) => (b.exam!.date).localeCompare(a.exam!.date));

  const chartData = [...myGrades].reverse().map((g) => ({
    name: g.exam!.name.slice(0, 5),
    score: g.score,
    total: g.exam!.totalScore,
  }));

  const avg = myGrades.length > 0
    ? Math.round(myGrades.reduce((s, g) => s + g.score, 0) / myGrades.length)
    : 0;

  return (
    <div className="flex flex-col pb-20">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">성적 조회</span>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[28px] font-bold text-[#4fc3a1]">{avg}점</div>
            <div className="text-[12px] text-white/60">평균 점수</div>
          </div>
          <div className="flex-1">
            <div className="text-[12px] text-white/60 mb-1">{myGrades.length}회 시험 응시</div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${avg}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
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
            {myGrades.map((g) => {
              const pct = Math.round((g.score / g.exam!.totalScore) * 100);
              const color = pct >= 90 ? '#4fc3a1' : pct >= 70 ? '#f59e0b' : '#ef4444';
              return (
                <div key={g.id} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[13px] font-semibold text-[#111827]">{g.exam!.name}</div>
                      <div className="text-[11.5px] text-[#6b7280]">{g.exam!.date} · {g.rank}등</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-bold" style={{ color }}>
                        {g.score}<span className="text-[13px] text-[#9ca3af] font-normal">/{g.exam!.totalScore}</span>
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
            {myGrades.length === 0 && (
              <div className="p-6 text-center text-[13px] text-[#9ca3af]">시험 기록 없음</div>
            )}
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
