import { describe, it, expect } from 'vitest';
import {
  buildLevelTestReportData,
  computeCohortAverages,
  josa,
  deriveRead,
  buildNarrative,
  showPlacement,
} from './report';
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

  it('내 점수는 평균과 무관하게 항상 보존 + correct/total 통과', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: false, useCohort: false, cohortAverages: null });
    expect(d.sections.map((s) => s.score)).toEqual([80, 60, 80]);
    expect(d.totalScore).toBe(72);
    expect(d.sections[0].correct).toBe(8);
    expect(d.sections[0].total).toBe(10);
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

describe('josa (조사 받침 처리)', () => {
  it('은/는: 받침 없음→는, 받침 있음→은', () => {
    expect(josa('어휘', '은는')).toBe('는');
    expect(josa('문법', '은는')).toBe('은');
  });
  it('이/가: 받침 없음→가, 받침 있음→이', () => {
    expect(josa('독해', '이가')).toBe('가');
    expect(josa('문법', '이가')).toBe('이');
  });
  it('으로/로: 받침없음·ㄹ받침→로, 그 외→으로 (반 이름 적용)', () => {
    expect(josa('정규반', '으로')).toBe('으로'); // 반 ㄴ받침
    expect(josa('기초반', '으로')).toBe('으로');
    expect(josa('영어과', '으로')).toBe('로'); // 과 받침없음 → 로
    expect(josa('서울', '으로')).toBe('로'); // 울 ㄹ받침 → 로
  });
  it('빈 문자열 폴백', () => {
    expect(josa('', '은는')).toBe('는');
    expect(josa('', '으로')).toBe('로');
  });
});

describe('deriveRead (강약 판정)', () => {
  it('±10 경계', () => {
    expect(deriveRead(80, 70)).toBe('강함');
    expect(deriveRead(80, 71)).toBe('보통');
    expect(deriveRead(60, 70)).toBe('보강');
    expect(deriveRead(65, 70)).toBe('보통');
  });
  it('average null이면 null(태그 숨김)', () => {
    expect(deriveRead(80, null)).toBeNull();
  });
});

describe('buildNarrative (반 기반 + 조사)', () => {
  const name = '김민준';
  const strongWeak = [
    { name: '어휘', score: 80, read: '강함' as const },
    { name: '문법', score: 70, read: '보통' as const },
    { name: '독해', score: 50, read: '보강' as const },
  ];

  it('강O·약O + 반 선택 → 배치 문장', () => {
    expect(buildNarrative({ studentName: name, sections: strongWeak, className: '정규반', showAverage: true })).toBe(
      '김민준 학생은 어휘는 또래 평균 이상이고 독해가 약해 정규반으로 배치했습니다.',
    );
  });
  it('강O·약O + 반 미선택 → 강약만 단독 종결', () => {
    expect(buildNarrative({ studentName: name, sections: strongWeak, className: null, showAverage: true })).toBe(
      '김민준 학생은 어휘는 또래 평균 이상이고 독해가 약합니다.',
    );
  });
  it('전부 보통 + 반 → 고르게 안정적', () => {
    const s = [
      { name: '어휘', score: 70, read: '보통' as const },
      { name: '문법', score: 72, read: '보통' as const },
    ];
    expect(buildNarrative({ studentName: name, sections: s, className: '정규반', showAverage: true })).toBe(
      '김민준 학생은 전 영역이 고르게 안정적이라 정규반으로 배치했습니다.',
    );
  });
  it('전부 보강 + 반 → 전반적 보강', () => {
    const s = [
      { name: '어휘', score: 40, read: '보강' as const },
      { name: '독해', score: 45, read: '보강' as const },
    ];
    expect(buildNarrative({ studentName: name, sections: s, className: '기초반', showAverage: true })).toBe(
      '김민준 학생은 전반적으로 보강이 필요해 기초반으로 배치했습니다.',
    );
  });
  it('showAverage=false + 반 → 점수 순위로', () => {
    const s = [
      { name: '어휘', score: 80, read: null },
      { name: '문법', score: 70, read: null },
      { name: '독해', score: 50, read: null },
    ];
    expect(buildNarrative({ studentName: name, sections: s, className: '정규반', showAverage: false })).toBe(
      '김민준 학생은 어휘가 가장 높고 독해 보완이 필요해 정규반으로 배치했습니다.',
    );
  });
  it('반 이름 받침 없으면 "로" (영어과로)', () => {
    const s = [{ name: '어휘', score: 70, read: '보통' as const }];
    expect(buildNarrative({ studentName: name, sections: s, className: '영어과', showAverage: true })).toBe(
      '김민준 학생은 전 영역이 고르게 안정적이라 영어과로 배치했습니다.',
    );
  });
});

describe('showPlacement (배치 카드 가드 술어)', () => {
  it('narrative·placement 둘 다 없으면 false (레거시)', () => {
    expect(showPlacement({ narrative: null, placement: null })).toBe(false);
    expect(showPlacement({ narrative: undefined, placement: undefined })).toBe(false);
  });
  it('narrative만 있어도 true (반 미선택 진단)', () => {
    expect(showPlacement({ narrative: '김민준 학생은 …', placement: null })).toBe(true);
  });
  it('placement 있으면 true', () => {
    expect(showPlacement({ narrative: null, placement: { classId: 'c1', className: '정규반' } })).toBe(true);
  });
});

describe('buildLevelTestReportData — 배치(반)/내러티브/레거시', () => {
  it('className 있으면 placement 스냅샷 + 배치 문장', () => {
    const d = buildLevelTestReportData({
      ...base, showAverage: true, useCohort: false, cohortAverages: null,
      className: '정규반', classId: 'cls_1',
    });
    expect(d.placement).toEqual({ classId: 'cls_1', className: '정규반' });
    expect(d.narrative).toContain('정규반으로 배치했습니다');
  });
  it('classId 없이 className만 → placement.classId null', () => {
    const d = buildLevelTestReportData({
      ...base, showAverage: true, useCohort: false, cohortAverages: null, className: '심화반',
    });
    expect(d.placement).toEqual({ classId: null, className: '심화반' });
  });
  it('narrative override 반영', () => {
    const d = buildLevelTestReportData({
      ...base, showAverage: true, useCohort: false, cohortAverages: null,
      className: '정규반', narrativeOverride: '커스텀 문장',
    });
    expect(d.narrative).toBe('커스텀 문장');
  });
  it('반 미선택 → placement null, 강약 진단 내러티브는 존재', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: true, useCohort: false, cohortAverages: null });
    expect(d.placement).toBeNull();
    expect(d.narrative).toBeTruthy();
    expect(d.narrative).not.toContain('배치했습니다'); // 반 없으니 배치절 없음
    expect(showPlacement(d)).toBe(true); // narrative만으로도 카드 표시
  });
  it('레거시(구 빌더 데이터)처럼 narrative 없으면 카드 숨김', () => {
    expect(showPlacement({ narrative: null, placement: null })).toBe(false);
  });
});
