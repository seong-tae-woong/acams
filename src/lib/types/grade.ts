// 성적 관련 타입 정의

export type AttitudeGrade = 'Excellent' | 'Good' | 'Need Effort' | 'Bad';

// 배점 방식: 'SCORE'(만점 기준 점수 입력) | 'COUNT'(맞힌 문제 수 입력 → 100점 환산)
export type ScoringMethod = 'SCORE' | 'COUNT';

export interface ExamCategory {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId: string | null;
}

export interface Exam {
  id: string;
  name: string;
  subject: string;
  classId: string;
  className: string;
  date: string; // ISO date string (YYYY-MM-DD)
  totalScore: number; // 만점 (COUNT 방식이면 100)
  scoringMethod: ScoringMethod; // 배점 방식
  totalQuestions: number | null; // COUNT 방식일 때 총 문제 수
  description: string;
  category1Id: string | null;
  category1Name: string | null;
  category2Id: string | null;
  category2Name: string | null;
  category3Id: string | null;
  category3Name: string | null;
}

export interface GradeRecord {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  score: number | null; // null이면 미입력 (COUNT 방식이면 100점 환산값)
  correctCount: number | null; // COUNT 방식일 때 맞힌 문제 수
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

export type GradeUpdateInput = Partial<Pick<GradeRecord, 'score' | 'correctCount' | 'rank' | 'memo'>>;

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
