// 레벨 테스트 — 공용 타입 (양식 questionMap/types, per-question 채점 도출)
// 설계 문서 §20 (per-question 채점 모델) 단일 출처.

/** 유형 정의 — 양식 및 Exam 스냅샷의 types[] 원소 */
export interface LevelTestType {
  /** 안정 slug (예: "vocab"). 양식에서 1회 생성, questionMap/sectionScores가 이걸로 매칭 */
  key: string;
  /** 표시명 (예: "어휘") */
  name: string;
  /** 영역별 기준점수 (100점 환산, 평균 비교의 초기값). 0~100 */
  benchmark: number;
}

/** 문항-유형 매핑 1건 — 양식 및 Exam 스냅샷의 questionMap[] 원소 */
export interface QuestionMapEntry {
  /** 문항 번호 (1..N) */
  n: number;
  /** LevelTestType.key */
  typeKey: string;
}

/** 학생 유형별 점수 — GradeRecord.sectionScores 캐시 원소 (도출 결과) */
export interface SectionScore {
  key: string;
  name: string;
  /** 맞힌 문항 수 */
  correct: number;
  /** 해당 유형 총 문항 수 */
  total: number;
  /** 100점 환산 (correct/total*100, 반올림) */
  score: number;
  /** 스냅샷 기준점수 (리포트 평균 비교용) */
  benchmark: number;
}

// ── 리포트(Report.data) 구조 — 객관 점수형, 서버 빌더·PWA 렌더 공용 ──

/** 리포트의 유형별 1행 (내 점수 vs 평균) */
export interface LevelTestReportSection {
  name: string;
  /** 내 점수 (100환산) */
  score: number;
  /** 비교 평균. null이면 그 영역 비교 숨김 (N=0/기준 미설정 — 1A) */
  average: number | null;
}

/** Report.data (kind=LEVEL_TEST) */
export interface LevelTestReportData {
  studentName: string;
  studentGrade: number | null;
  subject: string;
  date: string;
  /** 종합 점수 (100환산) */
  totalScore: number;
  /** 종합 평균. null이면 비교 숨김 */
  totalAverage: number | null;
  /** "학원 기준" | "응시자 평균" | null(숨김) */
  averageLabel: string | null;
  sections: LevelTestReportSection[];
  /** 선생님 코멘트 (발행 시 입력, 선택). 없으면 리포트에 코멘트 섹션 숨김 */
  comment?: string;
}
