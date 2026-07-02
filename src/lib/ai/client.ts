// Anthropic 클라이언트 + 구조화(tool-use) 호출 헬퍼.
// AI 호출은 반드시 Prisma 트랜잭션 '밖'에서 (eng-review: Neon P2028 회피).
import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

/** Anthropic 클라이언트 싱글턴. ANTHROPIC_API_KEY 환경변수 필요. */
export function getAnthropic(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    _client = new Anthropic();
  }
  return _client;
}

export interface AiUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
}

/** 안전 거부(refusal) — 예상 가능한 결과라 예외가 아니라 반환값으로 전달(호출부가 D6 처리). */
export interface AiRefusal {
  category: string | null;
}

export interface CallToolResult<T> {
  /** refusal이면 null */
  data: T | null;
  usage: AiUsage | null;
  refusal: AiRefusal | null;
}

/** 구조화 출력을 못 받음(tool_use 블록 없음) — 예기치 못한 실패라 throw. */
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiOutputError';
    Object.setPrototypeOf(this, AiOutputError.prototype); // 트랜스파일 시 instanceof 보존
  }
}

/**
 * tool-use로 구조화 JSON을 강제 호출한다.
 * - 정상: { data, usage, refusal: null }
 * - 안전 거부(refusal): { data: null, usage, refusal }
 * - tool_use 없음: AiOutputError throw
 * 네트워크/SDK 오류는 그대로 전파(라우트가 처리).
 * 반환 data는 스키마 신뢰(런타임 검증은 호출부/유닛테스트).
 */
export async function callTool<T>(opts: {
  model: string;
  system: string;
  user: string;
  toolName: string;
  description: string;
  inputSchema: Anthropic.Tool.InputSchema;
  maxTokens?: number;
}): Promise<CallToolResult<T>> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
    tools: [
      {
        name: opts.toolName,
        description: opts.description,
        input_schema: opts.inputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: opts.toolName },
  });

  const usage: AiUsage = {
    model: opts.model,
    tokensIn: res.usage.input_tokens,
    tokensOut: res.usage.output_tokens,
  };

  // stop_reason/stop_details는 SDK 버전차가 있어 방어적으로 접근.
  const stopReason = res.stop_reason as string | null;
  if (stopReason === 'refusal') {
    const category =
      (res as { stop_details?: { category?: string | null } }).stop_details
        ?.category ?? null;
    return { data: null, usage, refusal: { category } };
  }

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );
  if (!toolUse) {
    throw new AiOutputError('AI가 구조화 출력(tool_use)을 반환하지 않았습니다.');
  }

  return { data: toolUse.input as T, usage, refusal: null };
}
