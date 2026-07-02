// 자동 검수 서비스 (T5). 생성된 문항을 경량 모델(Haiku)로 검수 → 문항별 플래그.
// eng-review: 정답 재풀이·논리·글자깨짐 검출. INCOMPLETE는 생성 서비스가 판정(여기 아님).
// 검수 자체가 거부/실패하면 '미검수'로 폴백(호출부가 강사 전수검토). AI 호출은 트랜잭션 밖.
import { callTool, type AiUsage } from './client';
import {
  REVIEW_TOOL,
  REVIEW_SCHEMA,
  type GeneratedQuestion,
  type ReviewFlag,
  type ReviewOutput,
} from './schema';
import { AI_MODELS } from './models';

export interface QuestionReview {
  index: number; // 입력 배열 기준 문항 인덱스
  flags: ReviewFlag[];
}

export interface ReviewServiceResult {
  /** 플래그가 있는 문항만 */
  reviews: QuestionReview[];
  usage: AiUsage | null;
  /** 검수 자체가 거부됨 → 호출부가 '미검수' 표시(강사 전수검토 폴백) */
  refused: boolean;
}

/** 검수 모델이 낼 수 있는 유효 코드(INCOMPLETE는 생성 서비스가 붙임) */
const REVIEW_CODES = new Set<string>([
  'GARBLED_TEXT',
  'MISSING_CHOICE',
  'NO_CORRECT_ANSWER',
  'MULTIPLE_CORRECT',
  'ANSWER_MISMATCH',
  'DIFFICULTY_MISMATCH',
  'DUPLICATE',
]);

const REVIEW_SYSTEM = `당신은 시험 문항 검수자입니다. 각 문항을 검토해 '실제 결함이 확인된 문항만' 플래그로 보고합니다.

핵심 원칙:
- 플래그는 "이 문항에 이 결함이 있다"는 확정 판단입니다. 검토 후 문제가 없다고 판단되면 그 문항은 절대 보고하지 마세요(플래그 0개).
- 확신이 서는 결함만 보고합니다. 애매하거나 표현·스타일 차이 수준이면 플래그하지 않습니다.
- message에는 '확인된 결함과 올바른 수정'만 간결히 적습니다. 사고 과정·"다시 보니"·"~일 수도 있습니다" 같은 추측/자문자답은 넣지 마세요.

검사 항목(정답은 반드시 머릿속으로 다시 풀어 대조):
- 재풀이 결과 제시된 정답이 '확실히' 틀렸을 때만 ANSWER_MISMATCH(ERROR). 제시 정답이 맞거나 충분히 방어 가능하면 보고하지 않습니다.
- 객관식에 정답이 하나도 없으면 NO_CORRECT_ANSWER(ERROR), 정답이 둘 이상 확실히 성립하면 MULTIPLE_CORRECT(ERROR)
- 보기가 부족하거나 누락되면 MISSING_CHOICE(ERROR)
- 글자 깨짐·인코딩 오류가 있으면 GARBLED_TEXT(WARNING)
- 제시 난이도와 실제 난이도가 크게 다르면 DIFFICULTY_MISMATCH(WARNING)
- 다른 문항과 사실상 중복이면 DUPLICATE(WARNING)

severity: 정답·보기 관련 오류=ERROR, 그 외=WARNING.
반드시 ${REVIEW_TOOL} 도구로 '결함이 확인된 문항만' 인덱스(0-based)와 함께 출력하고, 결함이 없으면 results를 빈 배열로 둡니다.`;

/** 문항 배열을 검수 프롬프트로 변환 */
export function buildReviewPrompt(questions: GeneratedQuestion[]): string {
  const blocks = questions.map((q, i) => {
    const lines = [`[문항 ${i}]`, `지문: ${q.stem}`];
    if (q.choices.length > 0) {
      q.choices.forEach((c, ci) => lines.push(`  (${ci}) ${c}`));
      lines.push(`제시 정답 인덱스: ${q.answerIndex}`);
    } else {
      lines.push(`제시 정답(주관식): ${q.answerText ?? ''}`);
    }
    lines.push(`제시 난이도: ${q.difficulty}/5`);
    return lines.join('\n');
  });
  return blocks.join('\n\n');
}

/** 모델이 낸 플래그 중 스키마에 맞는 것만 통과 */
function isValidFlag(f: unknown): f is ReviewFlag {
  const x = f as Partial<ReviewFlag> | null;
  return (
    !!x &&
    typeof x.message === 'string' &&
    (x.severity === 'ERROR' || x.severity === 'WARNING') &&
    typeof x.code === 'string' &&
    REVIEW_CODES.has(x.code)
  );
}

/**
 * 생성된 문항을 검수한다.
 * - 문제 있는 문항만 reviews에 담김(플래그 0개 문항 제외).
 * - refusal: refused=true, 빈 reviews(호출부가 '미검수' 처리).
 * - 빈 입력: callTool 미호출.
 * - AiOutputError·네트워크: 전파(호출부가 '미검수'로 폴백).
 */
export async function reviewGeneratedQuestions(
  questions: GeneratedQuestion[],
): Promise<ReviewServiceResult> {
  if (questions.length === 0) {
    return { reviews: [], usage: null, refused: false };
  }

  const { data, usage, refusal } = await callTool<ReviewOutput>({
    model: AI_MODELS.review,
    system: REVIEW_SYSTEM,
    user: buildReviewPrompt(questions),
    toolName: REVIEW_TOOL,
    description: '각 문항의 문제점을 플래그로 보고한다.',
    inputSchema: REVIEW_SCHEMA,
    maxTokens: Math.min(8000, 1000 + questions.length * 300),
  });

  if (refusal) {
    return { reviews: [], usage, refused: true };
  }

  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const reviews: QuestionReview[] = [];
  for (const r of rawResults) {
    const rec = r as { index?: unknown; flags?: unknown };
    const index = typeof rec.index === 'number' ? rec.index : -1;
    if (index < 0 || index >= questions.length) continue; // 범위 밖 무시
    const flags = (Array.isArray(rec.flags) ? rec.flags : []).filter(isValidFlag);
    if (flags.length > 0) reviews.push({ index, flags });
  }

  return { reviews, usage, refused: false };
}
