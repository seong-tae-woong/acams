// 강사 관련 타입 정의

export interface TeacherPermissions {
  manageStudents: boolean; // 학생 관리
  manageClasses: boolean; // 반 관리
  manageAttendance: boolean; // 출결 관리
  manageGrades: boolean; // 성적 관리
  manageFinance: boolean; // 재무 관리
  manageNotifications: boolean; // 알림/공지 관리
  viewReports: boolean; // 리포트 조회
  admin: boolean; // 전체 관리자 권한
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  phone: string;
  email: string;
  classes: string[]; // 담당 반 ID 배열
  permissions: TeacherPermissions;
  isActive: boolean;
  avatarColor: string; // hex color (e.g. '#4A90D9')
}

export type TeacherCreateInput = Omit<Teacher, 'id'>;

export type TeacherUpdateInput = Partial<Omit<Teacher, 'id'>>;

export interface TeacherSummary {
  id: string;
  name: string;
  subject: string;
  classCount: number;
  isActive: boolean;
}

export interface TeacherFilter {
  subject?: string;
  isActive?: boolean;
  search?: string;
}

export const DEFAULT_PERMISSIONS: TeacherPermissions = {
  manageStudents: false,
  manageClasses: false,
  manageAttendance: true,
  manageGrades: true,
  manageFinance: false,
  manageNotifications: false,
  viewReports: true,
  admin: false,
};
