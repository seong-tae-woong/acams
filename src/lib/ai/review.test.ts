import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from './client';
import { reviewGeneratedQuestions } from './review';
import type { GeneratedQuestion } from './schema';

vi.mock('./client', () => ({
  callTool: vi.fn(),
  getAnthropic: vi.fn(),
  AiOutputError: class AiOutputError extends Error {},
}));

const mockCallTool = vi.mocked(callTool);
type CallToolResult = Awaited<ReturnType<typeof callTool>>;

function ok(results: unknown[]): CallToolResult {
  return {
    data: { results },
    usage: { model: 'claude-haiku-4-5', tokensIn: 20, tokensOut: 10 },
    refusal: null,
  } as CallToolResult;
}

function refusal(category: string | null): CallToolResult {
  return {
    data: null,
    usage: { model: 'claude-haiku-4-5', tokensIn: 5, tokensOut: 0 },
    refusal: { category },
  } as CallToolResult;
}

function q(o: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    stem: 's',
    choices: ['a', 'b', 'c', 'd'],
    answerIndex: 0,
    answerText: null,
    explanation: 'e',
    type: '문법',
    difficulty: 3,
    isKiller: false,
    conceptTags: [],
    ...o,
  };
}

const questions = [q(), q(), q()];

beforeEach(() => mockCallTool.mockReset());

describe('reviewGeneratedQuestions', () => {
  it('빈 입력 → callTool 미호출·빈 결과', async () => {
    const r = await reviewGeneratedQuestions([]);
    expect(r.reviews).toHaveLength(0);
    expect(mockCallTool).not.toHaveBeenCalled();
  });

  it('문제 없으면 reviews 비어있음(flags 빈 배열 제외)', async () => {
    mockCallTool.mockResolvedValue(
      ok([
        { index: 0, flags: [] },
        { index: 1, flags: [] },
      ]),
    );
    const r = await reviewGeneratedQuestions(questions);
    expect(r.reviews).toHaveLength(0);
    expect(r.refused).toBe(false);
  });

  it('정답 불일치 플래그 매핑', async () => {
    mockCallTool.mockResolvedValue(
      ok([
        {
          index: 1,
          flags: [{ code: 'ANSWER_MISMATCH', severity: 'ERROR', message: '정답이 ③임' }],
        },
      ]),
    );
    const r = await reviewGeneratedQuestions(questions);
    expect(r.reviews).toHaveLength(1);
    expect(r.reviews[0].index).toBe(1);
    expect(r.reviews[0].flags[0].code).toBe('ANSWER_MISMATCH');
  });

  it('여러 문항 플래그 매핑', async () => {
    mockCallTool.mockResolvedValue(
      ok([
        { index: 0, flags: [{ code: 'NO_CORRECT_ANSWER', severity: 'ERROR', message: 'x' }] },
        { index: 2, flags: [{ code: 'DUPLICATE', severity: 'WARNING', message: 'y' }] },
      ]),
    );
    const r = await reviewGeneratedQuestions(questions);
    expect(r.reviews.map((x) => x.index)).toEqual([0, 2]);
  });

  it('refusal → refused=true·빈 reviews', async () => {
    mockCallTool.mockResolvedValue(refusal('cyber'));
    const r = await reviewGeneratedQuestions(questions);
    expect(r.refused).toBe(true);
    expect(r.reviews).toHaveLength(0);
  });

  it('범위 밖 index 무시', async () => {
    mockCallTool.mockResolvedValue(
      ok([{ index: 99, flags: [{ code: 'GARBLED_TEXT', severity: 'WARNING', message: 'x' }] }]),
    );
    const r = await reviewGeneratedQuestions(questions);
    expect(r.reviews).toHaveLength(0);
  });

  it('잘못된 플래그(코드/severity) 필터링', async () => {
    mockCallTool.mockResolvedValue(
      ok([
        {
          index: 0,
          flags: [
            { code: 'BOGUS', severity: 'ERROR', message: 'x' }, // 잘못된 코드 → 제거
            { code: 'DUPLICATE', severity: 'oops', message: 'y' }, // 잘못된 severity → 제거
            { code: 'MULTIPLE_CORRECT', severity: 'ERROR', message: 'ok' }, // 유효
          ],
        },
      ]),
    );
    const r = await reviewGeneratedQuestions(questions);
    expect(r.reviews).toHaveLength(1);
    expect(r.reviews[0].flags).toHaveLength(1);
    expect(r.reviews[0].flags[0].code).toBe('MULTIPLE_CORRECT');
  });
});
