// 출제 스펙 파싱·검증 — generate 라우트·preset 라우트 공용(중복 방지).
import type { TestSpec, QuestionFormat, TestLayout } from '@/lib/types/questionBank';

export const MAX_COUNT = 20;

export type SpecParse = { ok: true; spec: TestSpec } | { ok: false; error: string };

/** 요청 body(플랫)에서 TestSpec을 파싱·검증한다. */
export function parseTestSpec(body: unknown): SpecParse {
  const b = (body ?? {}) as Record<string, unknown>;
  const subject = typeof b.subject === 'string' ? b.subject.trim() : '';
  const gradeLevel = typeof b.gradeLevel === 'string' ? b.gradeLevel.trim() : '';
  const type = typeof b.type === 'string' ? b.type.trim() : '';
  const difficulty = Number(b.difficulty);
  const count = Number(b.count);
  const comment = typeof b.comment === 'string' && b.comment.trim() ? b.comment.trim() : undefined;
  const isKiller = !!b.isKiller;
  const format: QuestionFormat = b.format === 'text' ? 'text' : 'choice';

  if (!subject || !gradeLevel || !type) {
    return { ok: false, error: '과목·학년·유형은 필수입니다.' };
  }
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    return { ok: false, error: '난이도는 1~5 사이여야 합니다.' };
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return { ok: false, error: `문항수는 1~${MAX_COUNT} 사이여야 합니다.` };
  }

  return {
    ok: true,
    spec: {
      subject,
      gradeLevel,
      type,
      difficulty,
      count,
      isKiller,
      format,
      ...(comment ? { comment } : {}),
    },
  };
}

/** 레이아웃 파싱 — 미지원 값은 BASIC로 폴백 */
export function parseLayout(v: unknown): TestLayout {
  return v === 'VOCAB' ? 'VOCAB' : 'BASIC';
}
