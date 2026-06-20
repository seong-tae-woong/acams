import { describe, it, expect } from 'vitest';
import {
  buildLevelTestReportData,
  computeCohortAverages,
  josa,
  suggestBand,
  resolveBands,
  deriveRead,
  buildNarrative,
  showPlacement,
  DEFAULT_LEVEL_BANDS,
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

describe('josa (조사 받침 처리)', () => {
  it('은/는: 받침 없음→는, 받침 있음→은', () => {
    expect(josa('어휘', '은는')).toBe('는');
    expect(josa('문법', '은는')).toBe('은');
    expect(josa('A반', '은는')).toBe('은'); // 반 ㄴ받침
  });
  it('이/가: 받침 없음→가, 받침 있음→이', () => {
    expect(josa('독해', '이가')).toBe('가');
    expect(josa('문법', '이가')).toBe('이');
  });
  it('으로/로: 받침없음·ㄹ받침→로, 그 외→으로', () => {
    expect(josa('상급', '으로')).toBe('으로'); // 급 ㅂ받침
    expect(josa('정규반', '으로')).toBe('으로'); // 반 ㄴ받침
    expect(josa('서울', '으로')).toBe('로'); // 울 ㄹ받침 → 로
    expect(josa('정규', '으로')).toBe('로'); // 규 받침없음 → 로
  });
  it('빈 문자열 폴백', () => {
    expect(josa('', '은는')).toBe('는');
    expect(josa('', '으로')).toBe('로');
  });
});

describe('suggestBand (점수→밴드, 경계 포함)', () => {
  const b = DEFAULT_LEVEL_BANDS; // 기초≤49 / 중급≤79 / 상급≤100
  it('경계값 정확히', () => {
    expect(suggestBand(49, b).key).toBe('basic');
    expect(suggestBand(50, b).key).toBe('inter');
    expect(suggestBand(79, b).key).toBe('inter');
    expect(suggestBand(80, b).key).toBe('adv');
    expect(suggestBand(100, b).key).toBe('adv');
    expect(suggestBand(0, b).key).toBe('basic');
  });
  it('상한 초과는 최상위로 clamp', () => {
    expect(suggestBand(120, b).key).toBe('adv');
  });
});

describe('resolveBands (양식 levelBands 파싱·폴백)', () => {
  it('비었거나 null이면 기본 프리셋', () => {
    expect(resolveBands([])).toEqual(DEFAULT_LEVEL_BANDS);
    expect(resolveBands(null)).toEqual(DEFAULT_LEVEL_BANDS);
    expect(resolveBands(undefined)).toEqual(DEFAULT_LEVEL_BANDS);
  });
  it('유효 밴드는 maxScore 오름차순 정렬', () => {
    const raw = [
      { key: 'b', label: '상', maxScore: 80 },
      { key: 'a', label: '하', maxScore: 40 },
    ];
    expect(resolveBands(raw).map((x) => x.key)).toEqual(['a', 'b']);
  });
  it('전부 깨진 항목이면 기본 프리셋 폴백', () => {
    expect(resolveBands([{ foo: 1 }, null])).toEqual(DEFAULT_LEVEL_BANDS);
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

describe('buildNarrative (자동 한 줄 판정 + 조사)', () => {
  const name = '김민준';
  it('강O·약O', () => {
    const s = [
      { name: '어휘', score: 80, read: '강함' as const },
      { name: '문법', score: 70, read: '보통' as const },
      { name: '독해', score: 50, read: '보강' as const },
    ];
    expect(buildNarrative({ studentName: name, sections: s, bandLabel: '중급', recommendClass: '정규반', showAverage: true })).toBe(
      '김민준 학생은 어휘는 또래 평균 이상이고 독해가 약해 중급(정규반)으로 배치했습니다.',
    );
  });
  it('전부 보통(약 없음) → 고르게 안정적', () => {
    const s = [
      { name: '어휘', score: 70, read: '보통' as const },
      { name: '문법', score: 72, read: '보통' as const },
    ];
    expect(buildNarrative({ studentName: name, sections: s, bandLabel: '중급', recommendClass: '정규반', showAverage: true })).toBe(
      '김민준 학생은 전 영역이 고르게 안정적이라 중급(정규반)으로 배치했습니다.',
    );
  });
  it('전부 보강(강 없음) → 전반적 보강', () => {
    const s = [
      { name: '어휘', score: 40, read: '보강' as const },
      { name: '독해', score: 45, read: '보강' as const },
    ];
    expect(buildNarrative({ studentName: name, sections: s, bandLabel: '기초', recommendClass: '기초반', showAverage: true })).toBe(
      '김민준 학생은 전반적으로 보강이 필요해 기초(기초반)으로 배치했습니다.',
    );
  });
  it('showAverage=false → 점수 순위로 (평균 언급 없음)', () => {
    const s = [
      { name: '어휘', score: 80, read: null },
      { name: '문법', score: 70, read: null },
      { name: '독해', score: 50, read: null },
    ];
    expect(buildNarrative({ studentName: name, sections: s, bandLabel: '중급', recommendClass: '정규반', showAverage: false })).toBe(
      '김민준 학생은 어휘가 가장 높고 독해 보완이 필요해 중급(정규반)으로 배치했습니다.',
    );
  });
  it('추천반 없으면 밴드만 + 조사(상급으로)', () => {
    const s = [
      { name: '어휘', score: 80, read: '강함' as const },
      { name: '독해', score: 50, read: '보강' as const },
    ];
    expect(buildNarrative({ studentName: name, sections: s, bandLabel: '상급', recommendClass: null, showAverage: true })).toBe(
      '김민준 학생은 어휘는 또래 평균 이상이고 독해가 약해 상급으로 배치했습니다.',
    );
  });
});

describe('showPlacement (레거시 가드 술어)', () => {
  it('placement 없으면 false', () => {
    expect(showPlacement({ placement: null })).toBe(false);
    expect(showPlacement({ placement: undefined })).toBe(false);
  });
  it('placement 있으면 true', () => {
    expect(showPlacement({ placement: { bandKey: 'inter', bandLabel: '중급', recommendClass: null, ladder: [], source: 'suggested' } })).toBe(true);
  });
});

describe('buildLevelTestReportData — 배치/내러티브/레거시', () => {
  it('bands 있으면 placement 자동 제안(suggested) + correct/total 통과', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: true, useCohort: false, cohortAverages: null, bands: DEFAULT_LEVEL_BANDS });
    expect(d.placement?.bandKey).toBe('inter'); // 72 → 중급
    expect(d.placement?.source).toBe('suggested');
    expect(d.placement?.recommendClass).toBe('정규반');
    expect(d.placement?.ladder.map((l) => l.key)).toEqual(['basic', 'inter', 'adv']);
    expect(d.narrative).toBeTruthy();
    expect(d.sections[0].correct).toBe(8);
    expect(d.sections[0].total).toBe(10);
  });
  it('chosenBandKey override → overridden + 해당 추천반', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: true, useCohort: false, cohortAverages: null, bands: DEFAULT_LEVEL_BANDS, chosenBandKey: 'adv' });
    expect(d.placement?.bandKey).toBe('adv');
    expect(d.placement?.source).toBe('overridden');
    expect(d.placement?.recommendClass).toBe('심화반');
  });
  it('recommendClass·narrative override 반영', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: true, useCohort: false, cohortAverages: null, bands: DEFAULT_LEVEL_BANDS, recommendClassOverride: '특별반', narrativeOverride: '커스텀 문장' });
    expect(d.placement?.recommendClass).toBe('특별반');
    expect(d.narrative).toBe('커스텀 문장');
  });
  it('레거시: bands 없으면 placement·narrative null (구 리포트 호환)', () => {
    const d = buildLevelTestReportData({ ...base, showAverage: true, useCohort: false, cohortAverages: null });
    expect(d.placement).toBeNull();
    expect(d.narrative).toBeNull();
    expect(showPlacement(d)).toBe(false);
    // correct/total은 여전히 통과
    expect(d.sections[0].correct).toBe(8);
  });
});
