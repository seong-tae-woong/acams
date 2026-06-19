import { describe, it, expect } from 'vitest';
import {
  validateQuestionMap,
  validateWrongNumbers,
  deriveSectionScores,
  computeScore100,
} from './scoring';
import type { LevelTestType, QuestionMapEntry } from './types';

const types: LevelTestType[] = [
  { key: 'vocab', name: '어휘', benchmark: 70 },
  { key: 'grammar', name: '문법', benchmark: 73 },
  { key: 'reading', name: '독해', benchmark: 74 },
];

// 1-10 어휘, 11-20 문법, 21-25 독해 (디자인 목업 예시와 동일)
function buildMap(): QuestionMapEntry[] {
  const m: QuestionMapEntry[] = [];
  for (let n = 1; n <= 10; n++) m.push({ n, typeKey: 'vocab' });
  for (let n = 11; n <= 20; n++) m.push({ n, typeKey: 'grammar' });
  for (let n = 21; n <= 25; n++) m.push({ n, typeKey: 'reading' });
  return m;
}

describe('validateQuestionMap', () => {
  it('정상 타일링은 ok', () => {
    const r = validateQuestionMap(buildMap(), types);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(25);
    expect(r.errors).toEqual([]);
  });
  it('빈틈(미매핑)을 잡는다', () => {
    const map = buildMap().filter((e) => e.n !== 13);
    const r = validateQuestionMap(map, types);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('매핑되지'))).toBe(true);
  });
  it('중복 문항을 잡는다', () => {
    const map = [...buildMap(), { n: 5, typeKey: 'vocab' }];
    const r = validateQuestionMap(map, types);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('중복'))).toBe(true);
  });
  it('알 수 없는 유형을 잡는다', () => {
    const map = buildMap().map((e) => (e.n === 1 ? { n: 1, typeKey: 'ghost' } : e));
    const r = validateQuestionMap(map, types);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('알 수 없는 유형'))).toBe(true);
  });
  it('유형 0개는 거부', () => {
    expect(validateQuestionMap(buildMap(), []).ok).toBe(false);
  });
});

describe('validateWrongNumbers', () => {
  it('정상 범위는 ok', () => {
    expect(validateWrongNumbers([3, 7, 24], 25).ok).toBe(true);
  });
  it('범위 밖을 잡는다', () => {
    expect(validateWrongNumbers([0, 26], 25).ok).toBe(false);
  });
  it('중복을 잡는다', () => {
    expect(validateWrongNumbers([3, 3], 25).ok).toBe(false);
  });
});

describe('deriveSectionScores', () => {
  it('목업 예시(틀린 7개) → 어휘 8/10·문법 6/10·독해 4/5', () => {
    const wrong = [3, 7, 13, 15, 18, 20, 24];
    const s = deriveSectionScores(buildMap(), types, wrong);
    const byKey = Object.fromEntries(s.map((x) => [x.key, x]));
    expect(byKey.vocab).toMatchObject({ correct: 8, total: 10, score: 80 });
    expect(byKey.grammar).toMatchObject({ correct: 6, total: 10, score: 60 });
    expect(byKey.reading).toMatchObject({ correct: 4, total: 5, score: 80 });
  });
  it('전부 정답이면 모든 영역 score 100', () => {
    const s = deriveSectionScores(buildMap(), types, []);
    expect(s.every((x) => x.score === 100)).toBe(true);
  });
  it('benchmark 스냅샷을 보존', () => {
    const s = deriveSectionScores(buildMap(), types, []);
    expect(s.find((x) => x.key === 'grammar')!.benchmark).toBe(73);
  });
});

describe('computeScore100', () => {
  it('18/25 → 72', () => {
    expect(computeScore100(25, 7)).toBe(72);
  });
  it('N=0 가드: NaN 없이 0 (eng 리뷰 critical gap)', () => {
    expect(computeScore100(0, 0)).toBe(0);
    expect(Number.isNaN(computeScore100(0, 0))).toBe(false);
  });
});
