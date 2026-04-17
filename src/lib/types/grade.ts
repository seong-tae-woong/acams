// 성적 관련 타입 정의

export type AttitudeGrade = 'Excellent' | 'Good' | 'Need Effort' | 'Bad';

export interface Exam {
  id: string;
  name: string;
  subject: string;
  classId: string;
  className: string;
  date: string; // ISO date string (YYYY-MM-DD)
  totalScore: number; // 만점
  description: string;
}

export interface GradeRecord {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  score: number;
  rank: number | null; // null이면 미산정
  memo: string;
}

export interface StudentReport {
  studentId: string;
  period: string; // 기간 (e.g. '2026-03', '2026-1학기')
  scores: ReportScore[];
  attitudes: ReportAttitude[];
  absences: number;
  totalClasses: number;
  comment: string; // 종합 소견
}

export interface ReportScore {
  subject: string;
  examName: string;
  score: number;
  totalScore: number;
  rank: number | null;
  classAverage: number;
}

export interface ReportAttitude {
  subject: string;
  grade: AttitudeGrade;
  comment: string;
}

export type ExamCreateInput = Omit<Exam, 'id'>;

export type GradeCreateInput = Omit<GradeRecord, 'id'>;

export type GradeUpdateInput = Partial<Pick<GradeRecord, 'score' | 'rank' | 'memo'>>;

export interface ExamSummary {
  examId: string;
  examName: string;
  classId: string;
  date: string;
  participantCount: number;
  average: number;
  highest: number;
  lowest: number;
}

export interface GradeFilter {
  studentId?: string;
  classId?: string;
  examId?: string;
  subject?: string;
  dateFrom?: string;
  dateTo?: string;
}
