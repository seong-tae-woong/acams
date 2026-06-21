// 레벨 테스트 리포트(Report.data) 빌더 — 객관 점수형 + 배치(반 선택)·내러티브.
// 설계 §8(객관 점수형) · §9(평균 기준→응시자 자동전환) · §9.1(트립와이어) · 1A(N=0 숨김)
// · §Q(디자인: 태그 미렌더). 배치 = 원장이 학원 실제 반을 직접 선택(밴드/단계 개념 없음).
// ⚠ 순수 모듈 — prisma/next 임포트 금지(클라/서버 공용: route + 발행 모달이 둘 다 import).
import type { SectionScore, LevelTestReportData, LevelTestReportSection, LevelTestPlacement } from './types';

/** N ≥ 이 값이면 '학원 기준' → '응시자 평균'으로 자동 전환 (설계 §9) */
export const LEVELTEST_COHORT_THRESHOLD = 20;

/** 양식당 누적 응시자가 이 값을 넘으면 5B(증분 캐시) 전환 검토 경보 (설계 §9.1) */
export const LEVELTEST_RESCAN_WARN = 500;

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

// ── 조사·강약·내러티브 (순수 헬퍼, 클라/서버 공용) ──

/**
 * 한국어 조사 선택 — 앞 단어의 받침 유무로 갈림. (조사 비문 방지)
 * 동적 슬롯(이름·영역·반)에 고정 조사를 쓰면 받침名에서 비문("어휘은") → 항상 이걸로.
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

/** 영역 강약 판정(내러티브용) — 표시되는 average에서 도출. showAverage=false면 average=null→null. (설계 §F·§Q) */
export function deriveRead(score: number, average: number | null): '강함' | '보통' | '보강' | null {
  if (average == null) return null;
  const diff = score - average;
  if (diff >= 10) return '강함';
  if (diff <= -10) return '보강';
  return '보통';
}

/**
 * 자동 한 줄 판정 내러티브 — 강약 요약 + (선택된 반이 있으면) 배치 문장.
 * className 없으면 강약만 단독 종결(원장이 반을 아직 안 고른 미리보기 상태). 원장이 모달에서 편집 가능.
 */
export function buildNarrative(input: {
  studentName: string;
  sections: { name: string; score: number; read: '강함' | '보통' | '보강' | null }[];
  className: string | null;
  showAverage: boolean;
}): string {
  const honor = `${(input.studentName ?? '').trim()} 학생은`;

  // 강약 사유 — 배치절(연결형, "…약해")과 단독 종결형("…약합니다") 두 가지
  let connective: string | null = null;
  let standalone: string | null = null;

  if (!input.showAverage) {
    // 평균 비교 숨김 → 점수 순위로 (평균 언급 없음)
    const sorted = [...input.sections].sort((a, b) => b.score - a.score);
    if (sorted.length >= 2 && sorted[0].name !== sorted[sorted.length - 1].name) {
      const top = sorted[0].name;
      const low = sorted[sorted.length - 1].name;
      connective = `${top}${josa(top, '이가')} 가장 높고 ${low} 보완이 필요해`;
      standalone = `${top}${josa(top, '이가')} 가장 높고 ${low} 보완이 필요합니다`;
    }
  } else {
    const strong = input.sections.filter((s) => s.read === '강함').map((s) => s.name).slice(0, 2);
    const weak = input.sections.filter((s) => s.read === '보강').map((s) => s.name);
    if (strong.length && weak.length) {
      const s = strong.join('·');
      const w = weak[0];
      connective = `${s}${josa(strong[strong.length - 1], '은는')} 또래 평균 이상이고 ${w}${josa(w, '이가')} 약해`;
      standalone = `${s}${josa(strong[strong.length - 1], '은는')} 또래 평균 이상이고 ${w}${josa(w, '이가')} 약합니다`;
    } else if (weak.length === 0) {
      connective = '전 영역이 고르게 안정적이라';
      standalone = '전 영역이 고르게 안정적입니다';
    } else {
      connective = '전반적으로 보강이 필요해';
      standalone = '전반적으로 보강이 필요합니다';
    }
  }

  const cls = input.className?.trim();
  if (cls) {
    const reason = connective ? `${connective} ` : '';
    return `${honor} ${reason}${cls}${josa(cls, '으로')} 배치했습니다.`;
  }
  return standalone ? `${honor} ${standalone}.` : '';
}

/** 배치(진단) 카드를 그릴지 — 레거시 리포트(narrative·placement 둘 다 없음)면 false. view가 이 술어만 호출. (설계 §Q·3B) */
export function showPlacement(data: Pick<LevelTestReportData, 'narrative' | 'placement'>): boolean {
  return !!(data.narrative && data.narrative.trim()) || !!data.placement;
}

/**
 * 리포트 데이터 조립 (단일 소스). 평균은 showAverage 토글 + 기준/응시자 선택을 반영.
 * 평균값이 없으면 해당 영역 비교를 숨긴다 (1A — 깨진 빈 막대 방지).
 * className(원장이 고른 반)이 있으면 배치(placement) 스냅샷 + 배치 문장, 없으면 강약 진단만.
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
  /** 원장이 고른 반 이름 (배치 대상). 없으면 강약 진단만. */
  className?: string;
  /** 원장이 고른 반의 Class id (스냅샷). */
  classId?: string;
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

  // 배치(반) + 내러티브. 발행 시 스냅샷 → 과거 리포트 불변(§20).
  const cls = input.className?.trim();
  const placement: LevelTestPlacement | null = cls ? { classId: input.classId ?? null, className: cls } : null;
  const readSections = sections.map((s) => ({ name: s.name, score: s.score, read: deriveRead(s.score, s.average) }));
  const auto = buildNarrative({ studentName: input.studentName, sections: readSections, className: cls ?? null, showAverage });
  const narrative = (input.narrativeOverride?.trim() || auto) || null;

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
