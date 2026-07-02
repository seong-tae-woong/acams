// 문제은행·자동출제 — 공유 타입 (P1)
// 설계: 문제출제_설계.md / 구현: 문제출제_구현계획_P1.md
// content 슈퍼셋 블록 모델: P1은 text만 사용, math·figure는 P2·P3에서 채운다.
// (Prisma의 BankQuestion.content / TestDraftItem.content Json 컬럼의 런타임 형태)

/** 문항 콘텐츠 블록 — 슈퍼셋(나중에 갈아엎지 않기 위해 처음부터 3종 정의) */
export type QuestionBlock =
  | { type: 'text'; text: string }
  | { type: 'math'; latex: string } //  P2·P3
  | { type: 'figure'; assetId: string; alt?: string }; //  P2·P3 (BankQuestionAsset.id)

/** 문항 본문 구조 (Prisma content Json의 형태) */
export interface QuestionContent {
  /** 문제 지문 */
  stem: QuestionBlock[];
  /** 객관식 보기 (없으면 주관식). 각 보기는 블록 배열 */
  choices?: QuestionBlock[][];
}

/** 정답 (Prisma answer Json의 형태) — 객관식=보기 인덱스, 주관식=텍스트 */
export type QuestionAnswer =
  | { kind: 'choice'; index: number }
  | { kind: 'text'; value: string };

/** 정형 입력(출제 스펙) — TestDraft.spec Json의 형태 */
export interface TestSpec {
  subject: string; // "영어"
  gradeLevel: string; // "중3"
  type: string; // "어휘" | "문법" | "독해" …
  difficulty: number; // 1~5 (1=하, 5=상)
  count: number; // 문항수 (≤20)
  comment?: string; // 자유 코멘트 ("자동사/타동사 구분")
  isKiller?: boolean; // 킬러 문항 요청
  format?: QuestionFormat; // 'choice'(객관식) | 'text'(주관식). 기본 choice
}

/** 문항 형식 — 객관식/주관식 강제(단어시험=text) */
export type QuestionFormat = 'choice' | 'text';

/** 인쇄 레이아웃 — Prisma enum TestLayout과 동기화 (내용 스펙과 분리된 출력 형태) */
export type TestLayout = 'BASIC' | 'VOCAB';

export const LAYOUT_LABELS: Record<TestLayout, string> = {
  BASIC: '기본형',
  VOCAB: '단어시험형',
};

/** 자동 검수 플래그 코드 — Prisma enum FlagCode와 동기화 유지 */
export type FlagCode =
  | 'GARBLED_TEXT'
  | 'MISSING_CHOICE'
  | 'NO_CORRECT_ANSWER'
  | 'MULTIPLE_CORRECT'
  | 'ANSWER_MISMATCH'
  | 'DIFFICULTY_MISMATCH'
  | 'DUPLICATE'
  | 'INCOMPLETE';

/** 난이도 라벨 매핑 (UI 표시용) */
export const DIFFICULTY_LABELS: Record<number, string> = {
  1: '하',
  2: '중하',
  3: '중',
  4: '중상',
  5: '상',
};
