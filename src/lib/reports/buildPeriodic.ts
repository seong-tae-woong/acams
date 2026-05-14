// PERIODIC 레포트 데이터 빌더
// 기간 + 학생 → 차트 프리셋별 raw 데이터 + TokenContext 요약

import { prisma } from '@/lib/db/prisma';
import type { ChartPresetKey } from '@/components/reports/charts';

export interface PeriodicPeriod {
  start: Date;
  end: Date;
  label: string;       // "최근 3개월" 등
  startLabel: string;  // "2026-02-01"
  endLabel: string;    // "2026-05-08"
}

// 발행 시점 기준 N개월 이전 1일부터 오늘까지
// 예: 오늘이 2026-05-08, months=3 → 2026-02-01 ~ 2026-05-08
export function computePeriod(months: number, ref: Date = new Date()): PeriodicPeriod {
  const start = new Date(ref.getFullYear(), ref.getMonth() - months, 1);
  const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    start, end,
    label: `최근 ${months}개월`,
    startLabel: fmt(start),
    endLabel: fmt(end),
  };
}

interface ScopeFilter {
  category1Ids?: string[];
  category2Ids?: string[];
  category3Ids?: string[];
  subjects?: string[];
}

export interface PeriodicDataResult {
  period: PeriodicPeriod;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  examCount: number;
  categoryLabels: string[]; // scopeFilter.category1Ids에 해당하는 이름들
  charts: {
    ScoreTrendLine: { label: string; score: number | null; total: number }[];
    CategoryRadar: { category: string; average: number }[];
    RankBand: { label: string; rank: number | null; classCount: number }[];
    AvgVsClass: { label: string; my: number | null; class: number | null }[];
    AttendanceBar: { month: string; absent: number; late: number }[];
  };
}

export async function buildPeriodicData(
  academyId: string,
  studentId: string,
  months: number,
  scope: ScopeFilter,
): Promise<PeriodicDataResult> {
  const period = computePeriod(months);

  // 시험 필터
  const examWhere: Record<string, unknown> = {
    academyId,
    date: { gte: period.start, lte: period.end },
  };
  if (scope.category1Ids?.length) examWhere.category1Id = { in: scope.category1Ids };
  if (scope.category2Ids?.length) examWhere.category2Id = { in: scope.category2Ids };
  if (scope.category3Ids?.length) examWhere.category3Id = { in: scope.category3Ids };
  if (scope.subjects?.length) examWhere.subject = { in: scope.subjects };

  // 학생의 성적 (해당 기간, 점수 입력된 것만)
  const grades = await prisma.gradeRecord.findMany({
    where: {
      academyId, studentId, score: { not: null },
      exam: examWhere,
    },
    include: {
      exam: {
        include: {
          class: { select: { name: true } },
          category1: { select: { name: true } },
        },
      },
    },
    orderBy: { exam: { date: 'asc' } },
  });

  // 반 평균 (시험별)
  const examIds = Array.from(new Set(grades.map((g) => g.examId)));
  const allClassGrades = examIds.length === 0 ? [] : await prisma.gradeRecord.findMany({
    where: { examId: { in: examIds }, score: { not: null } },
    select: { examId: true, score: true },
  });
  const classAvgByExam = new Map<string, number>();
  const classCountByExam = new Map<string, number>();
  for (const eid of examIds) {
    const list = allClassGrades.filter((g) => g.examId === eid);
    if (list.length > 0) {
      const avg = list.reduce((s, g) => s + (g.score as number), 0) / list.length;
      classAvgByExam.set(eid, Math.round(avg * 10) / 10);
      classCountByExam.set(eid, list.length);
    }
  }

  // ScoreTrendLine
  const trend = grades.map((g) => ({
    label: g.exam.name.length > 8 ? g.exam.name.slice(0, 8) + '…' : g.exam.name,
    score: g.score,
    total: g.exam.totalScore,
  }));

  // CategoryRadar (category1별 평균)
  const byCategory = new Map<string, { sum: number; count: number }>();
  for (const g of grades) {
    const catName = g.exam.category1?.name ?? (g.exam.subject || '기타');
    const prev = byCategory.get(catName) ?? { sum: 0, count: 0 };
    prev.sum += g.score as number;
    prev.count += 1;
    byCategory.set(catName, prev);
  }
  const radar = Array.from(byCategory.entries()).map(([category, v]) => ({
    category,
    average: Math.round((v.sum / v.count) * 10) / 10,
  }));

  // RankBand
  const rankBand = grades.map((g) => ({
    label: g.exam.name.length > 8 ? g.exam.name.slice(0, 8) + '…' : g.exam.name,
    rank: g.rank,
    classCount: classCountByExam.get(g.examId) ?? 0,
  }));

  // AvgVsClass
  const avgVsClass = grades.map((g) => ({
    label: g.exam.name.length > 8 ? g.exam.name.slice(0, 8) + '…' : g.exam.name,
    my: g.score,
    class: classAvgByExam.get(g.examId) ?? null,
  }));

  // AttendanceBar (기간 내 월별)
  const attendance = await prisma.attendanceRecord.findMany({
    where: { academyId, studentId, date: { gte: period.start, lte: period.end } },
    select: { date: true, status: true },
  });
  const attByMonth = new Map<string, { absent: number; late: number }>();
  for (const a of attendance) {
    const m = `${a.date.getMonth() + 1}월`;
    const prev = attByMonth.get(m) ?? { absent: 0, late: 0 };
    if (a.status === 'ABSENT') prev.absent++;
    else if (a.status === 'LATE') prev.late++;
    attByMonth.set(m, prev);
  }
  const attendanceBar = Array.from(attByMonth.entries()).map(([month, v]) => ({ month, ...v }));

  const scored = grades.map((g) => g.score as number);
  const averageScore = scored.length > 0
    ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
    : null;
  const highestScore = scored.length > 0 ? Math.max(...scored) : null;
  const lowestScore = scored.length > 0 ? Math.min(...scored) : null;

  // 카테고리 이름 매핑
  let categoryLabels: string[] = [];
  if (scope.category1Ids?.length) {
    const cats = await prisma.examCategory.findMany({
      where: { id: { in: scope.category1Ids } },
      select: { name: true },
    });
    categoryLabels = cats.map((c) => c.name);
  }

  return {
    period,
    averageScore,
    highestScore,
    lowestScore,
    examCount: grades.length,
    categoryLabels,
    charts: {
      ScoreTrendLine: trend,
      CategoryRadar: radar,
      RankBand: rankBand,
      AvgVsClass: avgVsClass,
      AttendanceBar: attendanceBar,
    },
  };
}

// PERIODIC 양식의 layout JSON 형태
export interface LayoutBlock {
  type: 'chart';
  preset: ChartPresetKey;
  title?: string;
}
