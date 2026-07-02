// 생성/검수 구조화 출력(tool-use input_schema) 정의.
// AI는 P1에서 텍스트로 출력 → 저장 시 QuestionContent 블록으로 래핑(래핑은 T4).
import type Anthropic from '@anthropic-ai/sdk';

// ── 생성 ─────────────────────────────────────────────

/** 생성된 문항 1개 (P1: 텍스트). tool_use.input의 questions[] 원소 형태 */
export interface GeneratedQuestion {
  stem: string; // 문제 지문
  choices: string[]; // 객관식 보기 (빈 배열 = 주관식)
  answerIndex: number | null; // 객관식 정답 인덱스(0-based)
  answerText: string | null; // 주관식 정답
  explanation: string; // 해설
  type: string; // 유형
  difficulty: number; // 1(하)~5(상)
  isKiller: boolean;
  conceptTags: string[];
}

export interface GeneratedQuestionSet {
  questions: GeneratedQuestion[];
}

export const GENERATION_TOOL = 'emit_questions';

export const QUESTION_SET_SCHEMA: Anthropic.Tool.InputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stem: { type: 'string', description: '문제 지문' },
          choices: {
            type: 'array',
            items: { type: 'string' },
            description: '객관식 보기. 주관식이면 빈 배열',
          },
          answerIndex: {
            type: ['integer', 'null'],
            description: '객관식 정답 인덱스(0-based). 주관식이면 null',
          },
          answerText: {
            type: ['string', 'null'],
            description: '주관식 정답. 객관식이면 null',
          },
          explanation: { type: 'string', description: '해설' },
          type: { type: 'string', description: '유형(예: 어휘/문법/독해)' },
          difficulty: { type: 'integer', description: '난이도 1(하)~5(상)' },
          isKiller: { type: 'boolean' },
          conceptTags: {
            type: 'array',
            items: { type: 'string' },
            description: '세부 개념 태그(예: 자동사/타동사)',
          },
        },
        required: [
          'stem',
          'choices',
          'answerIndex',
          'answerText',
          'explanation',
          'type',
          'difficulty',
          'isKiller',
          'conceptTags',
        ],
      },
    },
  },
  required: ['questions'],
};

// ── 검수 ─────────────────────────────────────────────

/** 자동 검수 모델이 문항별로 붙이는 플래그. (INCOMPLETE는 서비스가 count로 판정) */
export interface ReviewFlag {
  code:
    | 'GARBLED_TEXT'
    | 'MISSING_CHOICE'
    | 'NO_CORRECT_ANSWER'
    | 'MULTIPLE_CORRECT'
    | 'ANSWER_MISMATCH'
    | 'DIFFICULTY_MISMATCH'
    | 'DUPLICATE';
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export interface ReviewResult {
  index: number; // 문항 인덱스(0-based)
  flags: ReviewFlag[];
}

export interface ReviewOutput {
  results: ReviewResult[];
}

export const REVIEW_TOOL = 'report_flags';

export const REVIEW_SCHEMA: Anthropic.Tool.InputSchema = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: '문항 인덱스(0-based)' },
          flags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'GARBLED_TEXT',
                    'MISSING_CHOICE',
                    'NO_CORRECT_ANSWER',
                    'MULTIPLE_CORRECT',
                    'ANSWER_MISMATCH',
                    'DIFFICULTY_MISMATCH',
                    'DUPLICATE',
                  ],
                },
                severity: { type: 'string', enum: ['ERROR', 'WARNING'] },
                message: { type: 'string', description: '문제점 설명(한국어)' },
              },
              required: ['code', 'severity', 'message'],
            },
          },
        },
        required: ['index', 'flags'],
      },
    },
  },
  required: ['results'],
};
