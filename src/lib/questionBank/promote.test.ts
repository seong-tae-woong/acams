import { describe, it, expect } from 'vitest';
import { bankQuestionCreateData, type PromotableItem } from './promote';

const item: PromotableItem = {
  content: { stem: [{ type: 'text', text: '지문' }] },
  answer: { kind: 'choice', index: 1 },
  explanation: '해설',
  type: '문법',
  difficulty: 4,
  isKiller: true,
  conceptTags: ['자동사/타동사'],
};

describe('bankQuestionCreateData', () => {
  it('초안 문항 → BankQuestion 데이터(스펙 subject/grade + 문항 스냅샷)', () => {
    const d = bankQuestionCreateData(item, '영어', '중3', 'acad1', 'user1');
    expect(d.academyId).toBe('acad1');
    expect(d.subject).toBe('영어');
    expect(d.gradeLevel).toBe('중3');
    expect(d.type).toBe('문법');
    expect(d.difficulty).toBe(4);
    expect(d.isKiller).toBe(true);
    expect(d.conceptTags).toEqual(['자동사/타동사']);
    expect(d.source).toBe('AI_GENERATED');
    expect(d.reviewStatus).toBe('APPROVED');
    expect(d.createdBy).toBe('user1');
  });

  it('type/difficulty null이면 기본값(빈문자열/3)', () => {
    const d = bankQuestionCreateData(
      { ...item, type: null, difficulty: null },
      '영어',
      '중3',
      'a',
      'u',
    );
    expect(d.type).toBe('');
    expect(d.difficulty).toBe(3);
  });

  it('explanation null이면 필드 생략', () => {
    const d = bankQuestionCreateData({ ...item, explanation: null }, '영어', '중3', 'a', 'u');
    expect('explanation' in d).toBe(false);
  });
});
