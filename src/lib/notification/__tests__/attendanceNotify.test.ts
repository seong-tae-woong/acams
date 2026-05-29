import { describe, it, expect } from 'vitest';
import { classifyWindow, parseHHMM, toKstParts } from '../attendanceNotify';

describe('parseHHMM', () => {
  it('정상 형식을 분으로 변환한다', () => {
    expect(parseHHMM('09:30')).toBe(9 * 60 + 30);
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('23:59')).toBe(23 * 60 + 59);
  });

  it('한자리 시간도 받는다 (예: 9:30)', () => {
    expect(parseHHMM('9:30')).toBe(9 * 60 + 30);
  });

  it('범위 밖이면 null', () => {
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('12:60')).toBeNull();
  });

  it('형식 위반이면 null', () => {
    expect(parseHHMM('abc')).toBeNull();
    expect(parseHHMM('1230')).toBeNull();
    expect(parseHHMM('')).toBeNull();
  });
});

describe('classifyWindow', () => {
  // 임계값: 지각 10분 / 결석 20분 / cron 5분 주기

  it('수업 시작 전: NONE', () => {
    // 09:00 시작, 현재 08:55
    expect(classifyWindow(8 * 60 + 55, 9 * 60, 10, 20, 5)).toBe('NONE');
  });

  it('수업 시작 직후: NONE (아직 지각 임계값 전)', () => {
    // 09:00 시작, 현재 09:05 → elapsed 5분, 지각 임계값 10분 미만
    expect(classifyWindow(9 * 60 + 5, 9 * 60, 10, 20, 5)).toBe('NONE');
  });

  it('지각 임계값 도달 cron tick: LATE', () => {
    // 09:00 시작, 현재 09:10 → elapsed 10분, [10, 15) LATE 윈도우
    expect(classifyWindow(9 * 60 + 10, 9 * 60, 10, 20, 5)).toBe('LATE');
  });

  it('지각 임계값 + 4분 (같은 cron 윈도우 안): LATE', () => {
    expect(classifyWindow(9 * 60 + 14, 9 * 60, 10, 20, 5)).toBe('LATE');
  });

  it('지각 윈도우 지났지만 결석 임계값 전: NONE', () => {
    // elapsed 15분 → LATE 윈도우 [10,15) 종료, ABSENT는 20분
    expect(classifyWindow(9 * 60 + 15, 9 * 60, 10, 20, 5)).toBe('NONE');
  });

  it('결석 임계값 도달: ABSENT', () => {
    expect(classifyWindow(9 * 60 + 20, 9 * 60, 10, 20, 5)).toBe('ABSENT');
  });

  it('결석 윈도우 끝난 후: NONE', () => {
    expect(classifyWindow(9 * 60 + 25, 9 * 60, 10, 20, 5)).toBe('NONE');
  });

  it('수업이 이미 한참 지난 후 cron 호출: NONE (지각/결석 알림 안 감)', () => {
    expect(classifyWindow(11 * 60, 9 * 60, 10, 20, 5)).toBe('NONE');
  });

  it('cron interval 1분으로 좁히면 윈도우도 좁아진다', () => {
    // elapsed 10분, cron 1분 → [10, 11) 만 LATE
    expect(classifyWindow(9 * 60 + 10, 9 * 60, 10, 20, 1)).toBe('LATE');
    expect(classifyWindow(9 * 60 + 11, 9 * 60, 10, 20, 1)).toBe('NONE');
  });
});

describe('toKstParts', () => {
  it('UTC를 KST로 변환한다 — 자정 직후', () => {
    // 2026-05-29 00:00 KST = 2026-05-28 15:00 UTC
    const utc = new Date('2026-05-28T15:00:00.000Z');
    const { dayOfWeek, totalMinutes, midnightUtc } = toKstParts(utc);
    // 2026-05-29는 금요일 → dayOfWeek=5
    expect(dayOfWeek).toBe(5);
    expect(totalMinutes).toBe(0);
    expect(midnightUtc.toISOString()).toBe('2026-05-28T15:00:00.000Z');
  });

  it('일요일 변환: jsDay 0 → AcaMS dayOfWeek 7', () => {
    // 2026-05-31 12:00 KST = 2026-05-31 03:00 UTC (일요일)
    const utc = new Date('2026-05-31T03:00:00.000Z');
    const { dayOfWeek, totalMinutes } = toKstParts(utc);
    expect(dayOfWeek).toBe(7); // 일요일
    expect(totalMinutes).toBe(12 * 60);
  });

  it('월요일 변환', () => {
    // 2026-06-01 09:00 KST = 2026-06-01 00:00 UTC (월요일)
    const utc = new Date('2026-06-01T00:00:00.000Z');
    const { dayOfWeek, totalMinutes } = toKstParts(utc);
    expect(dayOfWeek).toBe(1);
    expect(totalMinutes).toBe(9 * 60);
  });

  it('자정 UTC 미드나잇 계산 정확성: KST 23:59 시점', () => {
    // 2026-05-29 23:59 KST = 2026-05-29 14:59 UTC
    const utc = new Date('2026-05-29T14:59:00.000Z');
    const { totalMinutes, midnightUtc } = toKstParts(utc);
    expect(totalMinutes).toBe(23 * 60 + 59);
    // 같은 KST 날짜의 자정 = 2026-05-29 00:00 KST = 2026-05-28 15:00 UTC
    expect(midnightUtc.toISOString()).toBe('2026-05-28T15:00:00.000Z');
  });
});
