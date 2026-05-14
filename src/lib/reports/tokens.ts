// 레포트 토큰 치환 엔진
// 양식 본문(bodyMarkdown)에 들어 있는 {{토큰}}을 학생 데이터로 치환

export interface TokenContext {
  // ── PER_EXAM + PERIODIC 공통 ──────────────
  학생?: string;
  학년?: number | string;
  반?: string;

  // ── PER_EXAM 전용 ─────────────────────────
  시험명?: string;
  시험일?: string;
  만점?: number;
  점수?: number | null;          // 시험 점수
  백분율?: number | null;
  순위?: number | null;
  반인원?: number;
  반평균?: number | null;
  반최고?: number | null;
  평균차이?: number | null;
  직전점수?: number | null;       // 조건부 토큰용

  // ── PERIODIC 전용 ─────────────────────────
  기간?: string;                  // "2026-05" / "2026-Q2" / "2026 상반기" / "2026"
  기간평균?: number | null;       // scopeFilter 적용된 시험 평균
  기간최고?: number | null;
  기간최저?: number | null;
  기간시험수?: number;
  대상카테고리?: string;          // 선택된 category1들의 이름 콤마 결합

  // 합격 임계값(%) — 발행 시점에 원장이 조정 가능, 기본 70
  passThreshold?: number;
}

type TokenGroup = { label: string; tokens: { token: string; description: string }[] };

const PER_EXAM_GROUPS: TokenGroup[] = [
  {
    label: '기본',
    tokens: [
      { token: '학생', description: '학생 이름' },
      { token: '학년', description: '학년' },
      { token: '반', description: '반 이름' },
      { token: '시험명', description: '시험 이름' },
      { token: '시험일', description: '시험 날짜' },
      { token: '만점', description: '만점 점수' },
    ],
  },
  {
    label: '점수',
    tokens: [
      { token: '점수', description: '획득 점수' },
      { token: '백분율', description: '점수 / 만점 × 100' },
    ],
  },
  {
    label: '순위',
    tokens: [
      { token: '순위', description: '반 내 순위' },
      { token: '반인원', description: '반 학생 수' },
    ],
  },
  {
    label: '통계',
    tokens: [
      { token: '반평균', description: '반 평균 점수' },
      { token: '반최고', description: '반 최고 점수' },
      { token: '평균차이', description: '본인 점수 − 반 평균' },
    ],
  },
  {
    label: '조건부',
    tokens: [
      { token: '우수/저조', description: '평균 이상이면 "우수", 미만이면 "저조"' },
      { token: '상승/하락', description: '직전 시험 대비 점수 변화' },
      { token: '합격/불합격', description: '백분율이 임계값 이상이면 "합격"' },
    ],
  },
];

const PERIODIC_GROUPS: TokenGroup[] = [
  {
    label: '기본',
    tokens: [
      { token: '학생', description: '학생 이름' },
      { token: '학년', description: '학년' },
      { token: '반', description: '반 이름' },
      { token: '기간', description: '발행 기간 (예: 2026-05, 2026-Q2)' },
      { token: '대상카테고리', description: '양식에서 선택한 시험 카테고리' },
    ],
  },
  {
    label: '평균',
    tokens: [
      { token: '기간평균', description: '기간·카테고리 내 본인 평균 점수' },
      { token: '기간최고', description: '기간 내 본인 최고 점수' },
      { token: '기간최저', description: '기간 내 본인 최저 점수' },
      { token: '기간시험수', description: '기간 내 응시 시험 수' },
    ],
  },
  {
    label: '조건부',
    tokens: [
      { token: '합격/불합격', description: '기간평균/100 ≥ 임계값(%)이면 "합격"' },
    ],
  },
];

// kind 별 토큰 그룹 반환
export function getTokenGroups(kind: 'PER_EXAM' | 'PERIODIC'): TokenGroup[] {
  return kind === 'PERIODIC' ? PERIODIC_GROUPS : PER_EXAM_GROUPS;
}

// 하위호환 — 기본은 PER_EXAM
export const TOKEN_GROUPS: TokenGroup[] = PER_EXAM_GROUPS;

const ALL_TOKENS = [...PER_EXAM_GROUPS, ...PERIODIC_GROUPS].flatMap((g) => g.tokens.map((t) => t.token));

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

// 조건부 토큰 평가
function evalConditional(token: string, ctx: TokenContext): string {
  if (token === '우수/저조') {
    if (ctx.평균차이 == null) return '-';
    return ctx.평균차이 >= 0 ? '우수' : '저조';
  }
  if (token === '상승/하락') {
    if (ctx.점수 == null || ctx.직전점수 == null) return '-';
    if (ctx.점수 > ctx.직전점수) return '상승';
    if (ctx.점수 < ctx.직전점수) return '하락';
    return '동일';
  }
  if (token === '합격/불합격') {
    const threshold = ctx.passThreshold ?? 70;
    // PER_EXAM은 백분율, PERIODIC은 기간평균(만점 100 가정)
    const pct = ctx.백분율 ?? ctx.기간평균;
    if (pct == null) return '-';
    return pct >= threshold ? '합격' : '불합격';
  }
  return token;
}

// 본문의 {{토큰}}을 모두 치환
export function renderBody(body: string, ctx: TokenContext): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_match, raw: string) => {
    const token = raw.trim();
    // 조건부
    if (token.includes('/')) return evalConditional(token, ctx);
    // 일반
    if (token in ctx) {
      const v = (ctx as unknown as Record<string, unknown>)[token];
      return fmt(v);
    }
    return _match; // 매칭 안 되면 원문 보존
  });
}

// 본문에 사용된 모든 토큰 추출 (검증용)
export function extractTokens(body: string): string[] {
  const out: string[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1].trim());
  return out;
}

// 등록되지 않은 토큰 찾기
export function findUnknownTokens(body: string): string[] {
  return extractTokens(body).filter((t) => !ALL_TOKENS.includes(t));
}
