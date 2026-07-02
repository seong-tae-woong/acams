// 문항 생성 서비스 (T4). 스펙 → 프롬프트 → callTool(tool-use) → GeneratedQuestion[].
// D6: 부분/거부/구조깨짐을 구조화 결과로 반환(호출부가 INCOMPLETE 플래그·재생성 결정).
// 비스트리밍(callTool). 스트리밍/진행표시 UX는 라우트(T6)가 담당.
// AI 호출은 Prisma 트랜잭션 '밖'에서 (Neon P2028 회피).
import { callTool, type AiUsage } from './client';
import {
  GENERATION_TOOL,
  QUESTION_SET_SCHEMA,
  type GeneratedQuestion,
  type GeneratedQuestionSet,
} from './schema';
import { pickGenerationModel } from './models';
import type { TestSpec } from '@/lib/types/questionBank';

export interface GenerateResult {
  questions: GeneratedQuestion[];
  usage: AiUsage | null;
  requested: number;
  /** kept < requested — 부분 생성(INCOMPLETE 플래그 대상) */
  incomplete: boolean;
  /** 구조적으로 못 쓰는 문항 제거 수(빈 지문·보기 배열 아님 등) */
  dropped: number;
  /** AI 안전 거부(refusal) */
  refused: boolean;
  refusalCategory: string | null;
}

const SYSTEM_PROMPT = `당신은 한국 학원의 시험 문제 출제 전문가입니다. 요청된 과목·학년·유형·난이도에 맞는 문항을 정확히 요청 개수만큼 생성합니다.

규칙:
- 모든 문항은 한국어로, 명확하고 사실에 근거해 작성합니다.
- 각 문항은 지문(stem), 보기(choices), 정답, 해설(explanation)을 포함합니다.
- 객관식은 보기 3~5개와 0-based 정답 인덱스(answerIndex)를 쓰고, 주관식은 보기를 빈 배열로 두고 answerText에 정답을 씁니다.
- 요청에 '형식'이 지정되면 모든 문항을 그 형식(객관식 또는 주관식)으로 통일합니다.
- 객관식 정답은 정확히 하나여야 하며, 정답은 사실에 근거해 정확해야 합니다.
- 요청 난이도(1~5)에 맞추고, 문항 간 중복을 피합니다.
- 반드시 ${GENERATION_TOOL} 도구로만 결과를 출력합니다.`;

/** 스펙(+선택 피드백)을 사용자 프롬프트로 변환 */
export function buildUserPrompt(spec: TestSpec, feedback?: string): string {
  const lines = [
    `과목: ${spec.subject}`,
    `학년: ${spec.gradeLevel}`,
    `유형: ${spec.type}`,
    `난이도: ${spec.difficulty}/5`,
    `문항수: ${spec.count}`,
  ];
  if (spec.format === 'text') {
    lines.push('형식: 전 문항 주관식 — choices는 빈 배열, answerText에 정답. (단어시험이면 각 문항은 단어/구를 제시하고 뜻·용법을 answerText로)');
  } else {
    lines.push('형식: 전 문항 객관식 — 보기 4~5개와 정답 인덱스.');
  }
  if (spec.isKiller) lines.push('킬러 문항(최고난도 변별용)으로 출제합니다.');
  if (spec.comment?.trim()) lines.push(`추가 요청: ${spec.comment.trim()}`);
  if (feedback?.trim()) lines.push(`강사 피드백(반영해 다시 생성): ${feedback.trim()}`);
  return lines.join('\n');
}

/** 요청 문항수에 맞춘 max_tokens (문항당 여유 + 기본) */
function maxTokensFor(count: number): number {
  return Math.min(16000, 2000 + count * 800);
}

/** 난이도를 1~5 정수로 보정 */
function clampDifficulty(d: unknown): number {
  const n = typeof d === 'number' && Number.isFinite(d) ? Math.round(d) : 3;
  return Math.max(1, Math.min(5, n));
}

/** 구조적으로 못 쓰는 문항은 null 반환(제거 대상). 정답 정확성 등은 검수(T5)가 판정. */
function normalizeQuestion(q: unknown): GeneratedQuestion | null {
  const x = q as Partial<GeneratedQuestion> | null;
  if (!x || typeof x.stem !== 'string' || x.stem.trim() === '') return null;
  if (!Array.isArray(x.choices)) return null;
  return {
    stem: x.stem.trim(),
    choices: x.choices.filter((c): c is string => typeof c === 'string'),
    answerIndex: typeof x.answerIndex === 'number' ? x.answerIndex : null,
    answerText: typeof x.answerText === 'string' ? x.answerText : null,
    explanation: typeof x.explanation === 'string' ? x.explanation : '',
    type: typeof x.type === 'string' ? x.type : '',
    difficulty: clampDifficulty(x.difficulty),
    isKiller: !!x.isKiller,
    conceptTags: Array.isArray(x.conceptTags)
      ? x.conceptTags.filter((t): t is string => typeof t === 'string')
      : [],
  };
}

/**
 * 스펙으로 문항을 생성한다. feedback이 있으면 재생성(피드백 라운드).
 * - 정상/부분: 받은 문항을 정규화해 반환, incomplete/dropped 표시.
 * - refusal: refused=true, 빈 결과(호출부가 사용자에게 안내).
 * - AiOutputError·네트워크 등 예기치 못한 실패: 전파(라우트가 처리).
 */
export async function generateQuestions(
  spec: TestSpec,
  feedback?: string,
): Promise<GenerateResult> {
  const requested = spec.count;
  const model = pickGenerationModel(!!spec.isKiller);

  const { data, usage, refusal } = await callTool<GeneratedQuestionSet>({
    model,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(spec, feedback),
    toolName: GENERATION_TOOL,
    description: '생성한 시험 문항 목록을 출력한다.',
    inputSchema: QUESTION_SET_SCHEMA,
    maxTokens: maxTokensFor(requested),
  });

  if (refusal) {
    return {
      questions: [],
      usage,
      requested,
      incomplete: true,
      dropped: 0,
      refused: true,
      refusalCategory: refusal.category,
    };
  }

  const raw = Array.isArray(data?.questions) ? data.questions : [];
  const kept: GeneratedQuestion[] = [];
  for (const item of raw) {
    const norm = normalizeQuestion(item);
    if (norm) kept.push(norm);
  }

  return {
    questions: kept,
    usage,
    requested,
    incomplete: kept.length < requested,
    dropped: raw.length - kept.length,
    refused: false,
    refusalCategory: null,
  };
}
