// 레벨 테스트 — per-question 채점 도출 (단일 소스).
// 설계 §20.2/§20.8: wrongNumbers(소스) + Exam 스냅샷(questionMap/types) → sectionScores.
// 모두 순수 함수. Prisma 비의존 → 단위 테스트 용이. 동일가중(문항당 1점).

import type { LevelTestType, QuestionMapEntry, SectionScore } from './types';

/**
 * questionMap이 1..N을 빠짐·겹침 없이 전수 1회 커버하는지 검증 (양식 저장 시 enforce).
 *
 *   questionMap = [{n:1,vocab},{n:2,vocab},...,{n:N,reading}]
 *        │ 모든 n ∈ 1..N 정확히 1회, 모든 typeKey ∈ types
 *        ▼
 *   { ok, total, errors }
 */
export function validateQuestionMap(
  questionMap: QuestionMapEntry[],
  types: LevelTestType[],
): { ok: boolean; total: number; errors: string[] } {
  const errors: string[] = [];
  const total = questionMap.length;
  const typeKeys = new Set(types.map((t) => t.key));
  const seen = new Set<number>();

  if (types.length === 0) errors.push('유형이 최소 1개 필요합니다.');

  for (const { n, typeKey } of questionMap) {
    if (!Number.isInteger(n) || n < 1) errors.push(`문항 번호가 비정상입니다: ${n}`);
    else if (seen.has(n)) errors.push(`문항 ${n}이 중복 매핑되었습니다.`);
    else seen.add(n);
    if (!typeKeys.has(typeKey)) errors.push(`문항 ${n}: 알 수 없는 유형 "${typeKey}"`);
  }
  // 1..total 전수 커버 확인 (빈틈 없음)
  for (let i = 1; i <= total; i++) {
    if (!seen.has(i)) errors.push(`문항 ${i}이 매핑되지 않았습니다.`);
  }

  return { ok: errors.length === 0, total, errors };
}

/** wrongNumbers가 1..total 범위 내 유효·무중복인지 검증 (채점 저장 시 enforce). */
export function validateWrongNumbers(
  wrongNumbers: number[],
  total: number,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const n of wrongNumbers) {
    if (!Number.isInteger(n) || n < 1 || n > total) errors.push(`틀린 번호가 범위를 벗어났습니다: ${n}`);
    else if (seen.has(n)) errors.push(`틀린 번호가 중복되었습니다: ${n}`);
    else seen.add(n);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * 유형별 점수 도출 (단일 소스). 채점 시 1회 호출해 GradeRecord.sectionScores에 캐시.
 * 입력(스냅샷 questionMap/types + 동결 wrongNumbers)이 불변이라 결과 결정적.
 */
export function deriveSectionScores(
  questionMap: QuestionMapEntry[],
  types: LevelTestType[],
  wrongNumbers: number[],
): SectionScore[] {
  const wrong = new Set(wrongNumbers);
  const acc = new Map<string, { total: number; correct: number }>();
  for (const t of types) acc.set(t.key, { total: 0, correct: 0 });

  for (const { n, typeKey } of questionMap) {
    const a = acc.get(typeKey);
    if (!a) continue; // 미지의 유형은 validateQuestionMap에서 차단됨
    a.total += 1;
    if (!wrong.has(n)) a.correct += 1;
  }

  return types.map((t) => {
    const a = acc.get(t.key)!;
    const score = a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0;
    return { key: t.key, name: t.name, correct: a.correct, total: a.total, score, benchmark: t.benchmark };
  });
}

/** 종합 100점 환산 = (총문항 − 오답수) / 총문항 × 100. total=0이면 0. */
export function computeScore100(total: number, wrongCount: number): number {
  if (total <= 0) return 0;
  return Math.round(((total - wrongCount) / total) * 100);
}
