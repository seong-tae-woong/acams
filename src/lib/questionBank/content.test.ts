import { describe, it, expect } from 'vitest';
import { toQuestionContent, toQuestionAnswer } from './content';
import type { GeneratedQuestion } from '@/lib/ai/schema';

function q(o: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    stem: '지문',
    choices: ['a', 'b', 'c', 'd'],
    answerIndex: 1,
    answerText: null,
    explanation: 'e',
    type: '문법',
    difficulty: 3,
    isKiller: false,
    conceptTags: [],
    ...o,
  };
}

describe('toQuestionContent', () => {
  it('객관식: stem + choices 블록으로 래핑', () => {
    const c = toQuestionContent(q({ stem: '다음 중 자동사는?', choices: ['run', 'arrive'] }));
    expect(c.stem).toEqual([{ type: 'text', text: '다음 중 자동사는?' }]);
    expect(c.choices).toEqual([
      [{ type: 'text', text: 'run' }],
      [{ type: 'text', text: 'arrive' }],
    ]);
  });

  it('주관식: choices 없음(undefined)', () => {
    const c = toQuestionContent(q({ choices: [] }));
    expect(c.choices).toBeUndefined();
    expect(c.stem).toHaveLength(1);
  });
});

describe('toQuestionAnswer', () => {
  it('객관식: kind=choice + index', () => {
    expect(
      toQuestionAnswer(q({ choices: ['a', 'b'], answerIndex: 1, answerText: null })),
    ).toEqual({ kind: 'choice', index: 1 });
  });

  it('주관식: kind=text + value', () => {
    expect(
      toQuestionAnswer(q({ choices: [], answerIndex: null, answerText: '정답' })),
    ).toEqual({ kind: 'text', value: '정답' });
  });

  it('주관식인데 answerText 없으면 빈 문자열', () => {
    expect(toQuestionAnswer(q({ choices: [], answerIndex: null, answerText: null }))).toEqual({
      kind: 'text',
      value: '',
    });
  });
});
