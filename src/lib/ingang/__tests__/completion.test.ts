import { describe, it, expect } from 'vitest';
import {
  isLectureCompleted,
  isSeriesCompleted,
  computeSeriesScoreAverage,
} from '../completion';

describe('isLectureCompleted (강의 단위 이수 판정 매트릭스)', () => {
  describe("examCond='after100'", () => {
    it('시청 완료 AND 시험 합격 → 이수', () => {
      expect(
        isLectureCompleted({
          watchCompletedAt: new Date('2026-05-29'),
          hasPassedAttempt: true,
          examCond: 'after100',
        }),
      ).toBe(true);
    });

    it('시청 완료 AND 시험 불합격 → 미이수', () => {
      expect(
        isLectureCompleted({
          watchCompletedAt: new Date('2026-05-29'),
          hasPassedAttempt: false,
          examCond: 'after100',
        }),
      ).toBe(false);
    });

    it('시청 미완 AND 시험 합격 → 미이수 (시청률 필수)', () => {
      expect(
        isLectureCompleted({
          watchCompletedAt: null,
          hasPassedAttempt: true,
          examCond: 'after100',
        }),
      ).toBe(false);
    });

    it('시청 미완 AND 시험 미응시 → 미이수', () => {
      expect(
        isLectureCompleted({
          watchCompletedAt: null,
          hasPassedAttempt: false,
          examCond: 'after100',
        }),
      ).toBe(false);
    });
  });

  describe("examCond='anytime' (YouTube 등 시청률 추적 불가)", () => {
    it('시험 합격 → 이수 (시청률 무관)', () => {
      expect(
        isLectureCompleted({
          watchCompletedAt: null,
          hasPassedAttempt: true,
          examCond: 'anytime',
        }),
      ).toBe(true);
    });

    it('시험 불합격 → 미이수', () => {
      expect(
        isLectureCompleted({
          watchCompletedAt: null,
          hasPassedAttempt: false,
          examCond: 'anytime',
        }),
      ).toBe(false);
    });

    it('시청 완료 + 시험 합격 → 이수 (시청률은 무시되지만 합격이면 이수)', () => {
      expect(
        isLectureCompleted({
          watchCompletedAt: new Date(),
          hasPassedAttempt: true,
          examCond: 'anytime',
        }),
      ).toBe(true);
    });
  });

  describe('examCond=null (quiz 없는 강의 — defensive)', () => {
    it('어떤 상태든 미이수 (시리즈 이수 자격 없음)', () => {
      expect(
        isLectureCompleted({
          watchCompletedAt: new Date(),
          hasPassedAttempt: true,
          examCond: null,
        }),
      ).toBe(false);
    });
  });
});

describe('isSeriesCompleted (시리즈 단위 이수 판정)', () => {
  it('모든 강의 이수 → 시리즈 이수', () => {
    expect(isSeriesCompleted([true, true, true])).toBe(true);
  });

  it('일부 미이수 → 시리즈 미이수', () => {
    expect(isSeriesCompleted([true, false, true])).toBe(false);
  });

  it('모두 미이수 → 시리즈 미이수', () => {
    expect(isSeriesCompleted([false, false, false])).toBe(false);
  });

  it('빈 시리즈 → 미이수 (defensive)', () => {
    expect(isSeriesCompleted([])).toBe(false);
  });

  it('강의 1개만 있는 시리즈 + 이수 → 시리즈 이수', () => {
    expect(isSeriesCompleted([true])).toBe(true);
  });
});

describe('computeSeriesScoreAverage (이수증 score snapshot)', () => {
  it('점수 여러 개 평균 (소수점 1자리 반올림)', () => {
    expect(computeSeriesScoreAverage([80, 90, 100])).toBe(90);
    expect(computeSeriesScoreAverage([70, 85])).toBe(77.5);
    expect(computeSeriesScoreAverage([72, 73, 74])).toBe(73);
  });

  it('일부 null 섞임 → null 제외하고 평균', () => {
    expect(computeSeriesScoreAverage([80, null, 100])).toBe(90);
  });

  it('모두 null → null 반환 (시험 없는 시리즈)', () => {
    expect(computeSeriesScoreAverage([null, null])).toBeNull();
  });

  it('빈 배열 → null', () => {
    expect(computeSeriesScoreAverage([])).toBeNull();
  });

  it('점수 1개 → 그 점수 그대로', () => {
    expect(computeSeriesScoreAverage([88])).toBe(88);
  });
});
