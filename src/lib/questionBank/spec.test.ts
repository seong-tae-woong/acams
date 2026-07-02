import { describe, it, expect } from 'vitest';
import { parseTestSpec, parseLayout, parseMockSpec, sectionToTestSpec } from './spec';

const base = { subject: '영어', gradeLevel: '중3', type: '어법', difficulty: 3, count: 5 };

describe('parseMockSpec', () => {
  const mbase = {
    subject: '영어',
    gradeLevel: '고1',
    title: '3월 모의고사',
    sections: [
      { label: '어법', type: '어법', count: 5, difficulty: 3, format: 'choice' },
      { label: '독해', type: '독해', count: 5, difficulty: 4 },
    ],
  };

  it('정상 → ok + sections', () => {
    const r = parseMockSpec(mbase);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.sections).toHaveLength(2);
      expect(r.spec.sections[0].format).toBe('choice');
      expect(r.spec.title).toBe('3월 모의고사');
    }
  });

  it('섹션 0개 → error', () => {
    expect(parseMockSpec({ ...mbase, sections: [] }).ok).toBe(false);
  });

  it('섹션 문항수>10 → error', () => {
    expect(parseMockSpec({ ...mbase, sections: [{ type: '어법', count: 11, difficulty: 3 }] }).ok).toBe(false);
  });

  it('섹션 유형 누락 → error', () => {
    expect(parseMockSpec({ ...mbase, sections: [{ type: '', count: 5, difficulty: 3 }] }).ok).toBe(false);
  });

  it('과목 누락 → error', () => {
    expect(parseMockSpec({ ...mbase, subject: '' }).ok).toBe(false);
  });

  it('sectionToTestSpec: 섹션 → 생성 스펙(과목·학년 상속)', () => {
    const r = parseMockSpec(mbase);
    if (!r.ok) throw new Error('parse failed');
    const s = sectionToTestSpec(r.spec, 1);
    expect(s.subject).toBe('영어');
    expect(s.gradeLevel).toBe('고1');
    expect(s.type).toBe('독해');
    expect(s.count).toBe(5);
    expect(s.difficulty).toBe(4);
  });
});

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
