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

export interface ClinicCheck {
  itemId: string;
  checked: boolean;
}

export interface ClinicResult {
  id: string;
  classId: string;
  studentId: string;
  sessionDate: string; // YYYY-MM-DD
  templateId: string;
  checks: ClinicCheck[];
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicResultUpsertInput {
  classId: string;
  studentId: string;
  sessionDate: string; // YYYY-MM-DD
  templateId: string;
  checks: ClinicCheck[];
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
  checks: Array<{ itemId: string; label: string; checked: boolean }>;
}

export interface StudentLessonTimelineEntry {
  date: string;
  classId: string;
  className: string;
  classColor: string;
  startTime: string;
  endTime: string;
  isOneTime: boolean;
  comment: string | null;
  clinics: StudentLessonTimelineClinic[];
}

export interface StudentLessonHistory {
  student: { id: string; name: string };
  range: { from: string; to: string };
  classes: StudentLessonHistoryClassRef[];
  summary: {
    commentCount: number;
    clinicByTemplate: StudentLessonClinicSummary[];
  };
  timeline: StudentLessonTimelineEntry[];
}

export interface StudentLessonHistoryQuery {
  studentId: string;
  classId?: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}
