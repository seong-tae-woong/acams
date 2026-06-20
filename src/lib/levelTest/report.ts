// 레벨 테스트 리포트(Report.data) 빌더 — 객관 점수형 + 배치 판정·내러티브.
// 설계 §8(객관 점수형) · §9(평균 기준→응시자 자동전환) · §9.1(트립와이어) · 1A(N=0 숨김)
// · §E/§F(밴드·내러티브) · §Q(디자인: 태그 미렌더, deriveRead는 내러티브용).
// ⚠ 순수 모듈 — prisma/next 임포트 금지(클라/서버 공용: route + 발행 모달이 둘 다 import).
import type {
  SectionScore,
  LevelTestReportData,
  LevelTestReportSection,
  LevelTestBand,
  LevelTestPlacement,
} from './types';

/** N ≥ 이 값이면 '학원 기준' → '응시자 평균'으로 자동 전환 (설계 §9) */
export const LEVELTEST_COHORT_THRESHOLD = 20;

/** 양식당 누적 응시자가 이 값을 넘으면 5B(증분 캐시) 전환 검토 경보 (설계 §9.1) */
export const LEVELTEST_RESCAN_WARN = 500;

/** 학원이 밴드를 설정하지 않았을 때의 기본 척도 (설계 §E — 설정 마찰 0). */
export const DEFAULT_LEVEL_BANDS: LevelTestBand[] = [
  { key: 'basic', label: '기초', maxScore: 49, recommendClass: '기초반' },
  { key: 'inter', label: '중급', maxScore: 79, recommendClass: '정규반' },
  { key: 'adv', label: '상급', maxScore: 100, recommendClass: '심화반' },
];

/**
 * 5A 즉석 집계: 캐시된 sectionScores들을 key별 평균(100환산).
 * 입력은 채점 완료된 응시자들의 sectionScores 배열.
 */
export function computeCohortAverages(records: SectionScore[][]): Map<string, number> {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const rec of records) {
    for (const sec of rec) {
      const a = acc.get(sec.key) ?? { sum: 0, count: 0 };
      a.sum += sec.score;
      a.count += 1;
      acc.set(sec.key, a);
    }
  }
  const out = new Map<string, number>();
  for (const [k, a] of acc) out.set(k, a.count > 0 ? Math.round(a.sum / a.count) : 0);
  return out;
}

/** §9.1 트립와이어: 재스캔 비용이 커지면 로그로 자가 경보 (데이터가 실제로 많아질 때) */
export function warnIfCohortLarge(takerCount: number, formId: string): void {
  if (takerCount > LEVELTEST_RESCAN_WARN) {
    console.warn(
      `[level-test] 평균 재스캔 ${takerCount}건 (form=${formId}) — 5B 증분캐시 전환 검토. 설계문서 §9.1.`,
    );
  }
}

// ── 밴드·조사·내러티브 (순수 헬퍼, 클라/서버 공용 — 설계 §F) ──

/**
 * 한국어 조사 선택 — 앞 단어의 받침 유무로 갈림. (설계 §F, 조사 비문 방지)
 * 동적 슬롯(이름·영역·밴드)에 고정 조사를 쓰면 받침名에서 비문("어휘은") → 항상 이걸로.
 */
export function josa(word: string, kind: '은는' | '이가' | '을를' | '으로'): string {
  const w = (word ?? '').trim();
  if (!w) return kind === '은는' ? '는' : kind === '이가' ? '가' : kind === '을를' ? '를' : '로';
  const code = w.charCodeAt(w.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const jong = isHangul ? (code - 0xac00) % 28 : 0; // 0 = 받침 없음(비한글 포함)
  const hasBatchim = jong !== 0;
  switch (kind) {
    case '은는':
      return hasBatchim ? '은' : '는';
    case '이가':
      return hasBatchim ? '이' : '가';
    case '을를':
      return hasBatchim ? '을' : '를';
    case '으로':
      // 받침 없음 또는 ㄹ받침(jong===8)이면 '로'
      return !hasBatchim || jong === 8 ? '로' : '으로';
  }
}

/** 양식의 levelBands(Json)를 안전 파싱 → 비었거나 깨졌으면 기본 프리셋. 항상 오름차순. (설계 §E) */
export function resolveBands(raw: unknown): LevelTestBand[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const bands = (raw as unknown[]).filter(
      (b): b is LevelTestBand =>
        !!b &&
        typeof (b as LevelTestBand).key === 'string' &&
        typeof (b as LevelTestBand).label === 'string' &&
        typeof (b as LevelTestBand).maxScore === 'number',
    );
    if (bands.length > 0) return [...bands].sort((a, b) => a.maxScore - b.maxScore);
  }
  return DEFAULT_LEVEL_BANDS;
}

/** 종합 점수 → 밴드 제안: maxScore 오름차순에서 score ≤ maxScore 첫 밴드, 미매칭이면 최상위 clamp. (설계 §F) */
export function suggestBand(score: number, bands: LevelTestBand[]): LevelTestBand {
  const sorted = [...bands].sort((a, b) => a.maxScore - b.maxScore);
  for (const b of sorted) {
    if (score <= b.maxScore) return b;
  }
  return sorted[sorted.length - 1];
}

/** 영역 강약 판정(내러티브용) — 표시되는 average에서 도출(재계산 금지). showAverage=false면 average=null→null. (설계 §F·§Q) */
export function deriveRead(score: number, average: number | null): '강함' | '보통' | '보강' | null {
  if (average == null) return null;
  const diff = score - average;
  if (diff >= 10) return '강함';
  if (diff <= -10) return '보강';
  return '보통';
}

/** 자동 한 줄 판정 내러티브 — 강/약 영역 + 밴드·추천반. 원장이 모달에서 편집 가능. (설계 §F) */
export function buildNarrative(input: {
  studentName: string;
  sections: { name: string; score: number; read: '강함' | '보통' | '보강' | null }[];
  bandLabel: string;
  recommendClass: string | null;
  showAverage: boolean;
}): string {
  const honor = `${(input.studentName ?? '').trim()} 학생은`;
  const placeWord = input.recommendClass || input.bandLabel; // 조사는 괄호 앞 마지막 단어 기준
  const placeText = input.recommendClass ? `${input.bandLabel}(${input.recommendClass})` : input.bandLabel;
  const tail = `${placeText}${josa(placeWord, '으로')} 배치했습니다.`;

  // showAverage=false → 평균 언급 없이 점수 순위로 (설계 §F)
  if (!input.showAverage) {
    const sorted = [...input.sections].sort((a, b) => b.score - a.score);
    if (sorted.length < 2 || sorted[0].name === sorted[sorted.length - 1].name) {
      return `${honor} ${tail}`;
    }
    const top = sorted[0].name;
    const low = sorted[sorted.length - 1].name;
    return `${honor} ${top}${josa(top, '이가')} 가장 높고 ${low} 보완이 필요해 ${tail}`;
  }

  const strong = input.sections.filter((s) => s.read === '강함').map((s) => s.name).slice(0, 2);
  const weak = input.sections.filter((s) => s.read === '보강').map((s) => s.name);

  if (strong.length && weak.length) {
    const strongStr = strong.join('·');
    const weakName = weak[0];
    return `${honor} ${strongStr}${josa(strong[strong.length - 1], '은는')} 또래 평균 이상이고 ${weakName}${josa(weakName, '이가')} 약해 ${tail}`;
  }
  if (weak.length === 0) {
    return `${honor} 전 영역이 고르게 안정적이라 ${tail}`;
  }
  return `${honor} 전반적으로 보강이 필요해 ${tail}`;
}

/** 배치 카드를 그릴지 — 레거시 리포트(placement 없음)면 false. view가 이 술어만 호출. (설계 §Q·3B) */
export function showPlacement(data: Pick<LevelTestReportData, 'placement'>): boolean {
  return !!data.placement && !!data.placement.bandLabel;
}

/**
 * 리포트 데이터 조립 (단일 소스). 평균은 showAverage 토글 + 기준/응시자 선택을 반영.
 * 평균값이 없으면 해당 영역 비교를 숨긴다 (1A — 깨진 빈 막대 방지).
 * bands가 주어지면 배치 판정(placement)·내러티브를 계산·스냅샷한다. (설계 §E/§F/§Q)
 */
export function buildLevelTestReportData(input: {
  studentName: string;
  studentGrade: number | null;
  subject: string;
  date: string;
  totalScore: number;
  sectionScores: SectionScore[];
  showAverage: boolean;
  /** 응시자 평균 사용 여부 (N≥임계). false면 기준점수(benchmark) 사용 */
  useCohort: boolean;
  /** 응시자 평균 (key별). useCohort일 때만 사용, 없으면 benchmark 폴백 */
  cohortAverages: Map<string, number> | null;
  /** 선생님 코멘트 (발행 시 입력, 선택) */
  comment?: string;
  /** 배치 척도 (resolveBands 결과). 없으면 배치 판정 생략(레거시 호환). */
  bands?: LevelTestBand[];
  /** 원장이 모달에서 고른 밴드 key (override). 없으면 점수로 자동 제안. */
  chosenBandKey?: string;
  /** 원장이 고친 추천 반 (override). 없으면 밴드 기본 추천반. */
  recommendClassOverride?: string;
  /** 원장이 고친 내러티브 (override). 없으면 자동 생성. */
  narrativeOverride?: string;
}): LevelTestReportData {
  const { sectionScores, showAverage, useCohort, cohortAverages } = input;

  const averageFor = (sec: SectionScore): number | null => {
    if (!showAverage) return null;
    if (useCohort) {
      const c = cohortAverages?.get(sec.key);
      return typeof c === 'number' ? c : sec.benchmark;
    }
    return sec.benchmark;
  };

  const sections: LevelTestReportSection[] = sectionScores.map((s) => ({
    name: s.name,
    score: s.score,
    average: averageFor(s),
    correct: s.correct,
    total: s.total,
  }));

  // 종합 평균 = 영역 평균을 문항수로 가중. 표시 평균이 하나도 없으면 null.
  let totalAverage: number | null = null;
  if (showAverage) {
    let weighted = 0;
    let totalQ = 0;
    for (const s of sectionScores) {
      const a = averageFor(s);
      if (a == null) continue;
      weighted += a * s.total;
      totalQ += s.total;
    }
    totalAverage = totalQ > 0 ? Math.round(weighted / totalQ) : null;
  }

  // 배치 판정 + 내러티브 (bands 있을 때만). 발행 시 스냅샷 → 과거 리포트 불변(§20).
  let placement: LevelTestPlacement | null = null;
  let narrative: string | null = null;
  if (input.bands && input.bands.length > 0) {
    const sorted = [...input.bands].sort((a, b) => a.maxScore - b.maxScore);
    const chosen = input.chosenBandKey ? sorted.find((b) => b.key === input.chosenBandKey) : undefined;
    const band = chosen ?? suggestBand(input.totalScore, sorted);
    const recommendClass = input.recommendClassOverride?.trim() || band.recommendClass || null;
    placement = {
      bandKey: band.key,
      bandLabel: band.label,
      recommendClass,
      ladder: sorted.map((b) => ({ key: b.key, label: b.label })),
      source: chosen ? 'overridden' : 'suggested',
    };
    const readSections = sections.map((s) => ({ name: s.name, score: s.score, read: deriveRead(s.score, s.average) }));
    narrative =
      input.narrativeOverride?.trim() ||
      buildNarrative({ studentName: input.studentName, sections: readSections, bandLabel: band.label, recommendClass, showAverage });
  }

  return {
    studentName: input.studentName,
    studentGrade: input.studentGrade,
    subject: input.subject,
    date: input.date,
    totalScore: input.totalScore,
    totalAverage,
    averageLabel: !showAverage ? null : useCohort ? '응시자 평균' : '학원 기준',
    sections,
    comment: input.comment?.trim() ? input.comment.trim() : undefined,
    placement,
    narrative,
  };
}
