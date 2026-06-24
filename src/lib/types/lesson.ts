// 수업 이력 관련 타입 정의 (Comment + Clinic)

export interface ClinicTemplateItem {
  id: string;
  label: string;
  order: number;
}

export interface ClinicTemplate {
  id: string;
  name: string;
  description: string;
  items: ClinicTemplateItem[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicTemplateCreateInput {
  name: string;
  description: string;
  items: ClinicTemplateItem[];
}

export interface ClinicTemplateUpdateInput {
  name?: string;
  description?: string;
  items?: ClinicTemplateItem[];
}

export interface LessonSession {
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isOneTime: boolean; // true=ClassEvent(보강), false=ClassSchedule(정규)
  color: string;
}

export interface LessonComment {
  id: string;
  classId: string;
  studentId: string;
  sessionDate: string; // YYYY-MM-DD
  comment: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonCommentUpsertInput {
  classId: string;
  studentId: string;
  sessionDate: string; // YYYY-MM-DD
  comment: string;
}

// 수업 단위 기록 (학생별이 아닌 해당 수업 전체에 대한 내용) — 반 × 날짜 별 1행
export interface LessonSessionNote {
  id: string;
  classId: string;
  sessionDate: string; // YYYY-MM-DD
  content: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LessonSessionNoteUpsertInput {
  classId: string;
  sessionDate: string; // YYYY-MM-DD
  content: string;
}

// 학생별 수업 평가 (태도 점수 + 사유 + 과제 수행) — 학생 × 날짜 × 반 별 1행
export interface LessonStudentEval {
  id: string;
  classId: string;
  studentId: string;
  sessionDate: string; // YYYY-MM-DD
  attitude: number | null; // 1~5
  attitudeReason: string | null;
  homeworkDone: boolean | null; // null=미설정, true=했음, false=안 함
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonStudentEvalUpsertInput {
  classId: string;
  studentId: string;
  sessionDate: string; // YYYY-MM-DD
  attitude: number | null;
  attitudeReason: string | null;
  homeworkDone: boolean | null;
}

/** 태도 5단계 기본 라벨 (1~5) */
export const ATTITUDE_LABELS: Record<number, string> = {
  1: '매우 미흡',
  2: '미흡',
  3: '보통',
  4: '우수',
  5: '매우 우수',
};

export interface ClinicCheck {
  itemId: string;
  checked: boolean;
}

// 이 세션에서만 사용하는 커스텀 항목 (양식과 분리)
export interface ClinicCustomItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ClinicResult {
  id: string;
  classId: string;
  studentId: string;
  sessionDate: string; // YYYY-MM-DD
  templateId: string;
  checks: ClinicCheck[];
  customItems: ClinicCustomItem[];
  hiddenItemIds: string[];
  authorId: string;
  authorName: string | null;
  checkedById: string | null;
  checkedByName: string | null;
  checkedAt: string | null; // ISO, 미체크면 null
  createdAt: string;
  updatedAt: string;
}

export interface ClinicResultUpsertInput {
  classId: string;
  studentId: string;
  sessionDate: string; // YYYY-MM-DD
  templateId: string;
  checks: ClinicCheck[];
  customItems: ClinicCustomItem[];
  hiddenItemIds: string[];
}

// ─────────────────────────────────────────────
// 보강 수업 코멘트 / Clinic (lessons와 분리)
// ─────────────────────────────────────────────

export interface MakeupComment {
  id: string;
  makeupClassId: string;
  studentId: string;
  comment: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MakeupCommentUpsertInput {
  makeupClassId: string;
  studentId: string;
  comment: string;
}

export interface MakeupClinicResult {
  id: string;
  makeupClassId: string;
  studentId: string;
  templateId: string;
  checks: ClinicCheck[];
  customItems: ClinicCustomItem[];
  hiddenItemIds: string[];
  authorId: string;
  authorName: string | null;
  checkedById: string | null;
  checkedByName: string | null;
  checkedAt: string | null; // ISO, 미체크면 null
  createdAt: string;
  updatedAt: string;
}

export interface MakeupClinicResultUpsertInput {
  makeupClassId: string;
  studentId: string;
  templateId: string;
  checks: ClinicCheck[];
  customItems: ClinicCustomItem[];
  hiddenItemIds: string[];
}

// ─────────────────────────────────────────────
// 학생별 수업 이력 (v2)
// ─────────────────────────────────────────────

export interface StudentLessonHistoryClassRef {
  id: string;
  name: string;
  color: string;
}

export interface StudentLessonClinicItemRate {
  itemId: string;
  label: string;
  total: number;
  checked: number;
  rate: number; // 0..1
}

export interface StudentLessonClinicSummary {
  templateId: string;
  templateName: string;
  isActive: boolean;
  itemRates: StudentLessonClinicItemRate[];
}

export interface StudentLessonTimelineClinic {
  templateId: string;
  templateName: string;
  isActive: boolean;
  // 양식 기반 항목 (이 세션에서 숨겨지지 않은 것만), source='template'
  // 이 세션에서 추가된 커스텀 항목, source='custom'
  checks: Array<{
    itemId: string;
    label: string;
    checked: boolean;
    source: 'template' | 'custom';
  }>;
}

export type AttendanceUiStatus = '출석' | '결석' | '지각' | '조퇴';

// 성취 모니터링 — 시험 점수 (세션 단위가 아니므로 별도)
export interface StudentLessonExam {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  subject: string;
  score: number;
  totalScore: number;
  rank: number | null;
}

export interface StudentLessonTimelineEntry {
  /** 'regular' = 정규 수업(class schedule 기반), 'makeup' = 보강 수업(MakeupClass) */
  kind: 'regular' | 'makeup';
  date: string;
  classId: string;
  className: string;
  classColor: string;
  startTime: string;
  endTime: string;
  /** @deprecated kind 사용. 기존 호환성을 위해 유지하지만 신규 코드는 kind === 'makeup' 사용. */
  isOneTime: boolean;
  comment: string | null;
  clinics: StudentLessonTimelineClinic[];
  // ── 성취 모니터링 필드 ──
  sessionNote: string | null;          // 수업 내용 (반 공통)
  attendanceStatus: AttendanceUiStatus | null; // 출석 상태
  attitude: number | null;             // 태도 점수 1~5
  attitudeReason: string | null;       // 태도 사유
  homeworkDone: boolean | null;        // 과제 수행 (null=미설정)
  // 보강 세션 식별 (정규 수업이면 null) — 클릭 시 상세 모달이 어느 키로 데이터를 조회할지 결정
  makeupClassId?: string | null;
  makeupReason?: string | null;
}

export interface StudentLessonHistory {
  student: { id: string; name: string };
  range: { from: string; to: string };
  classes: StudentLessonHistoryClassRef[];
  summary: {
    commentCount: number;
    clinicByTemplate: StudentLessonClinicSummary[];
    // ── 성취 모니터링 KPI ──
    attendance: { present: number; late: number; absent: number; earlyLeave: number; total: number; rate: number | null }; // rate = (출석+지각)/전체
    avgAttitude: number | null;        // 평균 태도 (1~5)
    attitudeCount: number;             // 태도 입력된 세션 수
    homework: { done: number; notDone: number; rate: number | null }; // rate = 했음/(했음+안함)
    avgScorePct: number | null;        // 평균 시험 점수 (만점 대비 %)
  };
  exams: StudentLessonExam[];
  timeline: StudentLessonTimelineEntry[];
}

export interface StudentLessonHistoryQuery {
  studentId: string;
  classIds?: string[]; // 빈 배열 또는 미지정 = 전체 반
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}
