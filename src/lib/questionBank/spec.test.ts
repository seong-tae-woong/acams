import { describe, it, expect } from 'vitest';
import { parseTestSpec, parseLayout } from './spec';

const base = { subject: '영어', gradeLevel: '중3', type: '어법', difficulty: 3, count: 5 };

describe('parseTestSpec', () => {
  it('정상 입력 → ok + spec(기본 format=choice)', () => {
    const r = parseTestSpec(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.subject).toBe('영어');
      expect(r.spec.format).toBe('choice');
    }
  });

  it('format=text 반영', () => {
    const r = parseTestSpec({ ...base, format: 'text' });
    expect(r.ok && r.spec.format).toBe('text');
  });

  it('필수(subject) 누락 → error', () => {
    expect(parseTestSpec({ ...base, subject: '' }).ok).toBe(false);
  });

  it('count>20 → error', () => {
    expect(parseTestSpec({ ...base, count: 21 }).ok).toBe(false);
  });

  it('난이도 범위밖 → error', () => {
    expect(parseTestSpec({ ...base, difficulty: 6 }).ok).toBe(false);
  });

  it('comment 공백이면 생략', () => {
    const r = parseTestSpec({ ...base, comment: '   ' });
    expect(r.ok && 'comment' in r.spec).toBe(false);
  });
});

describe('parseLayout', () => {
  it('VOCAB 통과', () => expect(parseLayout('VOCAB')).toBe('VOCAB'));
  it('미지원/undefined → BASIC', () => {
    expect(parseLayout('X')).toBe('BASIC');
    expect(parseLayout(undefined)).toBe('BASIC');
  });
});
