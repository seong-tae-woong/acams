import { describe, it, expect } from 'vitest';
import { buildLevelTestReportData, computeCohortAverages } from './report';
import type { SectionScore } from './types';

// 어휘 80(만점10), 문법 60(만점10), 독해 80(만점5) — benchmark 70/73/74
const sectionScores: SectionScore[] = [
  { key: 'vocab', name: '어휘', correct: 8, total: 10, score: 80, benchmark: 70 },
  { key: 'grammar', name: '문법', correct: 6, total: 10, score: 60, benchmark: 73 },
  { key: 'reading', name: '독해', correct: 4, total: 5, score: 80, benchmark: 74 },
];

const base = {
  studentName: '김민준',
  studentGrade: 2,
  subject: '영어',
  date: '2026-06-18',
  totalScore: 72,
  sectionScores,
};

describe('buildLevelTestReportData', () => {
  it('showAverage=false → 모든 비교 숨김 (1A)', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: false, useCohort: false, cohortAverages: null });
    expect(d.averageLabel).toBeNull();
    expect(d.totalAverage).toBeNull();
    expect(d.sections.every((s) => s.average === null)).toBe(true);
  });

  it('기준점수 모드(useCohort=false) → benchmark + "학원 기준"', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: true, useCohort: false, cohortAverages: null });
    expect(d.averageLabel).toBe('학원 기준');
    const byName = Object.fromEntries(d.sections.map((s) => [s.name, s.average]));
    expect(byName['어휘']).toBe(70);
    expect(byName['문법']).toBe(73);
    // 종합 평균 = (70*10 + 73*10 + 74*5)/25 = 71.8 → 72
    expect(d.totalAverage).toBe(72);
  });

  it('응시자 평균 모드(useCohort=true) → cohort 사용, 없는 key는 benchmark 폴백', () => {
    const cohort = new Map<string, number>([['vocab', 65], ['grammar', 68]]); // reading 없음
    const d = buildLevelTestReportData({ ...base, showAverage: true, useCohort: true, cohortAverages: cohort });
    expect(d.averageLabel).toBe('응시자 평균');
    const byName = Object.fromEntries(d.sections.map((s) => [s.name, s.average]));
    expect(byName['어휘']).toBe(65);
    expect(byName['문법']).toBe(68);
    expect(byName['독해']).toBe(74); // benchmark 폴백
  });

  it('내 점수는 평균과 무관하게 항상 보존', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: false, useCohort: false, cohortAverages: null });
    expect(d.sections.map((s) => s.score)).toEqual([80, 60, 80]);
    expect(d.totalScore).toBe(72);
  });
});

describe('computeCohortAverages', () => {
  it('key별 score 평균을 낸다', () => {
    const recs: SectionScore[][] = [
      [{ key: 'vocab', name: '어휘', correct: 8, total: 10, score: 80, benchmark: 70 }],
      [{ key: 'vocab', name: '어휘', correct: 6, total: 10, score: 60, benchmark: 70 }],
    ];
    const avg = computeCohortAverages(recs);
    expect(avg.get('vocab')).toBe(70); // (80+60)/2
  });
});
