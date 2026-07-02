import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from './client';
import { generateQuestions } from './generate';
import type { TestSpec } from '@/lib/types/questionBank';
import type { GeneratedQuestion } from './schema';

// callTool만 mock. refusal은 (throw가 아니라) 반환값이라 resolving mock으로 테스트.
vi.mock('./client', () => ({
  callTool: vi.fn(),
  getAnthropic: vi.fn(),
  AiOutputError: class AiOutputError extends Error {},
}));

const mockCallTool = vi.mocked(callTool);
type CallToolResult = Awaited<ReturnType<typeof callTool>>;

function ok(questions: unknown[]): CallToolResult {
  return {
    data: { questions },
    usage: { model: 'claude-sonnet-4-6', tokensIn: 10, tokensOut: 20 },
    refusal: null,
  } as CallToolResult;
}

function refusal(category: string | null): CallToolResult {
  return {
    data: null,
    usage: { model: 'claude-sonnet-4-6', tokensIn: 5, tokensOut: 0 },
    refusal: { category },
  } as CallToolResult;
}

function q(o: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    stem: '다음 중 자동사는?',
    choices: ['run', 'eat', 'sleep', 'arrive'],
    answerIndex: 3,
    answerText: null,
    explanation: 'arrive는 목적어가 필요 없는 자동사.',
    type: '문법',
    difficulty: 3,
    isKiller: false,
    conceptTags: ['자동사/타동사'],
    ...o,
  };
}

const spec: TestSpec = {
  subject: '영어',
  gradeLevel: '중3',
  type: '문법',
  difficulty: 3,
  count: 5,
};

beforeEach(() => mockCallTool.mockReset());

describe('generateQuestions', () => {
  it('정상: 요청 개수만큼 반환, incomplete=false', async () => {
    mockCallTool.mockResolvedValue(ok(Array.from({ length: 5 }, () => q())));
    const r = await generateQuestions(spec);
    expect(r.questions).toHaveLength(5);
    expect(r.incomplete).toBe(false);
    expect(r.dropped).toBe(0);
    expect(r.refused).toBe(false);
    expect(r.usage?.tokensOut).toBe(20);
  });

  it('부분: 요청보다 적게 오면 incomplete=true', async () => {
    mockCallTool.mockResolvedValue(ok(Array.from({ length: 3 }, () => q())));
    const r = await generateQuestions({ ...spec, count: 10 });
    expect(r.questions).toHaveLength(3);
    expect(r.incomplete).toBe(true);
    expect(r.requested).toBe(10);
  });

  it('refusal: 안전 거부는 refused=true·빈 결과', async () => {
    mockCallTool.mockResolvedValue(refusal('cyber'));
    const r = await generateQuestions(spec);
    expect(r.refused).toBe(true);
    expect(r.refusalCategory).toBe('cyber');
    expect(r.questions).toHaveLength(0);
    expect(r.incomplete).toBe(true);
  });

  it('구조 깨짐: 못 쓰는 문항 제거·dropped 카운트', async () => {
    mockCallTool.mockResolvedValue(
      ok([
        q(), // 정상
        q({ stem: '' }), // 빈 지문 → drop
        { choices: [], explanation: 'x' }, // stem 없음 → drop
        { ...q(), choices: 'notarray' }, // choices 배열 아님 → drop
      ]),
    );
    const r = await generateQuestions(spec);
    expect(r.questions).toHaveLength(1);
    expect(r.dropped).toBe(3);
  });

  it('킬러: isKiller면 Opus 모델로 호출', async () => {
    mockCallTool.mockResolvedValue(ok([q()]));
    await generateQuestions({ ...spec, isKiller: true, count: 1 });
    expect(mockCallTool).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-8' }),
    );
  });
});
