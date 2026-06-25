'use client';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { StudentLessonHistory } from '@/lib/types/lesson';

interface SummaryCardProps {
  data: StudentLessonHistory;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// 만점 대비 환산 점수 (다른 만점의 시험을 비교 가능하게)
function examPct(e: { score: number; totalScore: number }): number | null {
  return e.totalScore > 0 ? Math.round((e.score / e.totalScore) * 100) : null;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: ReactNode }) {
  return (
    <div className="flex-1 min-w-[130px] rounded-[10px] border border-[#e2e8f0] bg-white p-3">
      <div className="text-[11.5px] text-[#6b7280] mb-1">{label}</div>
      <div className="text-[20px] font-bold text-[#111827] tabular-nums leading-none">{value}</div>
      <div className="text-[10.5px] text-[#6b7280] mt-1">{sub}</div>
    </div>
  );
}

export default function SummaryCard({ data }: SummaryCardProps) {
  const { student, range, summary, exams } = data;
  const a = summary.attendance;
  const attRate = a.rate != null ? `${Math.round(a.rate * 100)}%` : '–';
  const avgAtt = summary.avgAttitude != null ? summary.avgAttitude.toFixed(1) : '–';
  const hwRate = summary.homework.rate != null ? `${Math.round(summary.homework.rate * 100)}%` : '–';

  // 최근 시험점수 + 직전 대비 추세 (exams는 API에서 최신순 정렬)
  const latestPct = exams.length > 0 ? examPct(exams[0]) : null;
  const latestScore = latestPct != null ? `${latestPct}점` : '–';

  let examTrendSub: ReactNode;
  if (exams.length === 0) {
    examTrendSub = '시험 없음';
  } else if (exams.length === 1) {
    examTrendSub = '첫 시험 · 만점 대비';
  } else {
    const lp = examPct(exams[0]);
    const pp = examPct(exams[1]);
    if (lp == null || pp == null) {
      examTrendSub = '만점 대비';
    } else {
      const d = lp - pp;
      if (d === 0) {
        examTrendSub = '직전과 동일';
      } else {
        const up = d > 0;
        examTrendSub = (
          <span className={clsx('inline-flex items-center gap-0.5', up ? 'text-[#0f6e56]' : 'text-[#b45309]')}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            직전 대비 {Math.abs(d)}점
          </span>
        );
      }
    }
  }

  return (
    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[14px] font-semibold text-[#111827]">{student.name}</span>
        <span className="text-[12px] text-[#6b7280]">
          {formatDate(range.from)} ~ {formatDate(range.to)}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Kpi
          label="출석률"
          value={attRate}
          sub={a.total > 0 ? `출석 ${a.present} · 지각 ${a.late} · 결석 ${a.absent}${a.earlyLeave ? ` · 조퇴 ${a.earlyLeave}` : ''}` : '출결 기록 없음'}
        />
        <Kpi
          label="평균 태도"
          value={avgAtt}
          sub={summary.attitudeCount > 0 ? `${summary.attitudeCount}회 평가 · 5점 만점` : '평가 없음'}
        />
        <Kpi
          label="과제 수행률"
          value={hwRate}
          sub={summary.homework.done + summary.homework.notDone > 0 ? `했음 ${summary.homework.done} · 안 함 ${summary.homework.notDone}` : '기록 없음'}
        />
        <Kpi
          label="최근 시험점수"
          value={latestScore}
          sub={examTrendSub}
        />
      </div>
    </div>
  );
}
