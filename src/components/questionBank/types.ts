// 문제출제 UI 공용 타입·라벨 — API 응답 형태(Prisma include)에 맞춤.
import { DIFFICULTY_LABELS } from '@/lib/types/questionBank';
import type {
  QuestionBlock,
  QuestionContent,
  QuestionAnswer,
  TestSpec,
  TestLayout,
} from '@/lib/types/questionBank';

/** 저장된 출제 양식(프리셋) — GET /presets 응답 */
export interface PresetListItem {
  id: string;
  name: string;
  spec: TestSpec;
  layout: TestLayout;
  createdAt: string;
}

export type DraftStatus = 'GENERATING' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';

export interface DraftFlag {
  id: string;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  resolved: boolean;
}

export interface DraftItem {
  id: string;
  order: number;
  content: QuestionContent;
  answer: QuestionAnswer;
  explanation: string | null;
  type: string | null;
  difficulty: number | null;
  isKiller: boolean;
  conceptTags: string[];
  flags: DraftFlag[];
}

export interface DraftTurn {
  id: string;
  round: number;
  role: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  createdAt: string;
}

export interface DraftDetail {
  id: string;
  spec: TestSpec;
  status: DraftStatus;
  layout: TestLayout;
  title: string;
  createdAt: string;
  updatedAt: string;
  items: DraftItem[];
  turns: DraftTurn[];
}

export interface DraftListItem {
  id: string;
  spec: TestSpec;
  status: DraftStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _count: { items: number };
}

export const STATUS_LABELS: Record<DraftStatus, string> = {
  GENERATING: '생성 중',
  REVIEW: '검수 대기',
  APPROVED: '승인됨',
  ARCHIVED: '보관',
};

// Badge 색상 매핑용(Badge는 label로 색을 정함) — 커스텀 클래스로 오버라이드
export const STATUS_BADGE_CLASS: Record<DraftStatus, string> = {
  GENERATING: 'bg-[#DBEAFE] text-[#1d4ed8]',
  REVIEW: 'bg-[#FEF3C7] text-[#92400E]',
  APPROVED: 'bg-[#D1FAE5] text-[#065f46]',
  ARCHIVED: 'bg-[#f1f5f9] text-[#6b7280]',
};

// FlagCode(Prisma enum) → 한글 라벨
export const FLAG_LABELS: Record<string, string> = {
  GARBLED_TEXT: '글자 깨짐',
  MISSING_CHOICE: '보기 누락',
  NO_CORRECT_ANSWER: '정답 없음',
  MULTIPLE_CORRECT: '복수 정답',
  ANSWER_MISMATCH: '정답 불일치',
  DIFFICULTY_MISMATCH: '난이도 불일치',
  DUPLICATE: '중복 문항',
  INCOMPLETE: '문항수 미달',
};

/** 난이도 숫자 → 라벨(없으면 '-'). Record 인덱싱 undefined 방지용 */
export function diffLabel(n?: number | null): string {
  return n != null ? (DIFFICULTY_LABELS[n] ?? String(n)) : '-';
}

/** 블록 배열 → 표시용 평문(HTML용, PDF와 달리 sanitize 안 함) */
export function blocksToPlainText(blocks: QuestionBlock[] | undefined): string {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => {
      if (b?.type === 'text') return b.text ?? '';
      if (b?.type === 'math') return b.latex ?? '';
      if (b?.type === 'figure') return '[그림]';
      return '';
    })
    .join(' ')
    .trim();
}
