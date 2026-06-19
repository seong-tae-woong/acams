// 레벨 테스트 리포트(Report.data) 빌더 — 객관 점수형.
// 설계 §8(객관 점수형) · §9(평균 기준→응시자 자동전환) · §9.1(트립와이어) · 1A(N=0 숨김).
import type { SectionScore, LevelTestReportData, LevelTestReportSection } from './types';

/** N ≥ 이 값이면 '학원 기준' → '응시자 평균'으로 자동 전환 (설계 §9) */
export const LEVELTEST_COHORT_THRESHOLD = 20;

/** 양식당 누적 응시자가 이 값을 넘으면 5B(증분 캐시) 전환 검토 경보 (설계 §9.1) */
export const LEVELTEST_RESCAN_WARN = 500;

/**
 * 5A 즉석 집계: 캐시된 sectionScores들을 key별 평균(100환산).
 * 입력은 채점 완료된 응시자들의 sectionScores 배열.
 */
export function computeCohortAverages(records: SectionScore[][]): Map<string, number> {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const rec of records) {
    for (const sec of rec) {
      const a = acc.get(sec.key) ?? { sum: 0, count: 0 };
      a.sum += sec.score;
      a.count += 1;
      acc.set(sec.key, a);
    }
  }
  const out = new Map<string, number>();
  for (const [k, a] of acc) out.set(k, a.count > 0 ? Math.round(a.sum / a.count) : 0);
  return out;
}

/** §9.1 트립와이어: 재스캔 비용이 커지면 로그로 자가 경보 (데이터가 실제로 많아질 때) */
export function warnIfCohortLarge(takerCount: number, formId: string): void {
  if (takerCount > LEVELTEST_RESCAN_WARN) {
    console.warn(
      `[level-test] 평균 재스캔 ${takerCount}건 (form=${formId}) — 5B 증분캐시 전환 검토. 설계문서 §9.1.`,
    );
  }
}

/**
 * 리포트 데이터 조립 (단일 소스). 평균은 showAverage 토글 + 기준/응시자 선택을 반영.
 * 평균값이 없으면 해당 영역 비교를 숨긴다 (1A — 깨진 빈 막대 방지).
 */
export function buildLevelTestReportData(input: {
  studentName: string;
  studentGrade: number | null;
  subject: string;
  date: string;
  totalScore: number;
  sectionScores: SectionScore[];
  showAverage: boolean;
  /** 응시자 평균 사용 여부 (N≥임계). false면 기준점수(benchmark) 사용 */
  useCohort: boolean;
  /** 응시자 평균 (key별). useCohort일 때만 사용, 없으면 benchmark 폴백 */
  cohortAverages: Map<string, number> | null;
}): LevelTestReportData {
  const { sectionScores, showAverage, useCohort, cohortAverages } = input;

  const averageFor = (sec: SectionScore): number | null => {
    if (!showAverage) return null;
    if (useCohort) {
      const c = cohortAverages?.get(sec.key);
      return typeof c === 'number' ? c : sec.benchmark;
    }
    return sec.benchmark;
  };

  const sections: LevelTestReportSection[] = sectionScores.map((s) => ({
    name: s.name,
    score: s.score,
    average: averageFor(s),
  }));

  // 종합 평균 = 영역 평균을 문항수로 가중. 표시 평균이 하나도 없으면 null.
  let totalAverage: number | null = null;
  if (showAverage) {
    let weighted = 0;
    let totalQ = 0;
    for (const s of sectionScores) {
      const a = averageFor(s);
      if (a == null) continue;
      weighted += a * s.total;
      totalQ += s.total;
    }
    totalAverage = totalQ > 0 ? Math.round(weighted / totalQ) : null;
  }

  return {
    studentName: input.studentName,
    studentGrade: input.studentGrade,
    subject: input.subject,
    date: input.date,
    totalScore: input.totalScore,
    totalAverage,
    averageLabel: !showAverage ? null : useCohort ? '응시자 평균' : '학원 기준',
    sections,
  };
}
