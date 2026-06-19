// 레벨 테스트 양식 입력의 types/questionMap 정규화 + 검증 (생성·수정 공용).
import { validateQuestionMap } from './scoring';
import type { LevelTestType, QuestionMapEntry } from './types';

export type FormPayloadResult =
  | { ok: false; error: string }
  | { ok: true; types: LevelTestType[]; questionMap: QuestionMapEntry[] };

/** 양식 payload의 types/questionMap을 깨끗한 형태로 정규화하고 무결성 검증. */
export function normalizeFormTypesAndMap(body: {
  types?: unknown;
  questionMap?: unknown;
}): FormPayloadResult {
  const rawTypes = Array.isArray(body.types) ? body.types : [];
  if (rawTypes.length === 0) return { ok: false, error: '유형을 최소 1개 추가하세요.' };

  const keys = new Set<string>();
  const types: LevelTestType[] = [];
  for (const t of rawTypes as Record<string, unknown>[]) {
    const key = typeof t?.key === 'string' ? t.key.trim() : '';
    const name = typeof t?.name === 'string' ? t.name.trim() : '';
    const benchmark = Number(t?.benchmark);
    if (!key || !name) return { ok: false, error: '유형의 키와 이름은 필수입니다.' };
    if (keys.has(key)) return { ok: false, error: `유형 키가 중복되었습니다: ${key}` };
    if (!Number.isFinite(benchmark) || benchmark < 0 || benchmark > 100) {
      return { ok: false, error: `기준점수는 0~100이어야 합니다: ${name}` };
    }
    keys.add(key);
    types.push({ key, name, benchmark: Math.round(benchmark) });
  }

  const rawMap = Array.isArray(body.questionMap) ? body.questionMap : [];
  const questionMap: QuestionMapEntry[] = (rawMap as Record<string, unknown>[]).map((e) => ({
    n: Number(e?.n),
    typeKey: typeof e?.typeKey === 'string' ? e.typeKey : '',
  }));
  const vm = validateQuestionMap(questionMap, types);
  if (!vm.ok) return { ok: false, error: vm.errors[0] };

  return { ok: true, types, questionMap };
}
