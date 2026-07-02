// 출제 스펙 파싱·검증 — generate 라우트·preset 라우트 공용(중복 방지).
import type {
  TestSpec,
  QuestionFormat,
  TestLayout,
  MockSpec,
  SectionSpec,
} from '@/lib/types/questionBank';

// Hobby(Vercel) 함수 60초 상한 안전 여유 — 10문항 ≈ 35~45초. Pro(300초) 전환 시 상향 가능.
export const MAX_COUNT = 10;

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
  if (v === 'VOCAB') return 'VOCAB';
  if (v === 'MOCK') return 'MOCK';
  return 'BASIC';
}

export type MockParse = { ok: true; spec: MockSpec } | { ok: false; error: string };

/** 모의고사 스펙 파싱·검증 — 섹션 배열(각 섹션 ≤MAX_COUNT). */
export function parseMockSpec(body: unknown): MockParse {
  const b = (body ?? {}) as Record<string, unknown>;
  const subject = typeof b.subject === 'string' ? b.subject.trim() : '';
  const gradeLevel = typeof b.gradeLevel === 'string' ? b.gradeLevel.trim() : '';
  const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim() : undefined;
  if (!subject || !gradeLevel) {
    return { ok: false, error: '과목·학년은 필수입니다.' };
  }
  const raw = Array.isArray(b.sections) ? b.sections : [];
  if (raw.length === 0) return { ok: false, error: '섹션을 최소 1개 추가하세요.' };
  if (raw.length > 10) return { ok: false, error: '섹션은 최대 10개입니다.' };

  const sections: SectionSpec[] = [];
  for (const rs of raw) {
    const s = (rs ?? {}) as Record<string, unknown>;
    const type = typeof s.type === 'string' ? s.type.trim() : '';
    const count = Number(s.count);
    const difficulty = Number(s.difficulty);
    const label = typeof s.label === 'string' && s.label.trim() ? s.label.trim() : undefined;
    const format: QuestionFormat = s.format === 'text' ? 'text' : 'choice';
    const isKiller = !!s.isKiller;
    if (!type) return { ok: false, error: '각 섹션의 유형은 필수입니다.' };
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
      return { ok: false, error: `섹션 문항수는 1~${MAX_COUNT} 사이여야 합니다.` };
    }
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      return { ok: false, error: '섹션 난이도는 1~5 사이여야 합니다.' };
    }
    sections.push({ type, count, difficulty, format, isKiller, ...(label ? { label } : {}) });
  }
  return { ok: true, spec: { subject, gradeLevel, sections, ...(title ? { title } : {}) } };
}

/** 모의고사의 한 섹션 → 생성용 TestSpec */
export function sectionToTestSpec(mock: MockSpec, i: number): TestSpec {
  const s = mock.sections[i];
  return {
    subject: mock.subject,
    gradeLevel: mock.gradeLevel,
    type: s.type,
    difficulty: s.difficulty,
    count: s.count,
    format: s.format,
    isKiller: s.isKiller,
    ...(s.label ? { comment: `이 섹션은 '${s.label}' 유형입니다.` } : {}),
  };
}
