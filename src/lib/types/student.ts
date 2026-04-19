// 학생 관련 타입 정의

export enum StudentStatus {
  ACTIVE = '재원',
  ON_LEAVE = '휴원',
  WITHDRAWN = '퇴원',
  WAITING = '대기',
}

export interface Student {
  id: string;
  name: string;
  school: string;
  grade: number; // 학년 (1~6 초등, 7~9 중등, 10~12 고등)
  phone: string;
  parentName: string;
  parentPhone: string;
  status: StudentStatus;
  enrollDate: string; // ISO date string (YYYY-MM-DD)
  classes: string[]; // 반 ID 배열
  siblingIds: string[]; // 형제/자매 학생 ID 배열
  memo: string;
  avatarColor: string; // hex color (e.g. '#4A90D9')
  attendanceNumber: string; // 출결번호
  qrCode: string; // QR코드 데이터
  birthDate?: string; // 생년월일 YYYY-MM-DD
}

export type StudentCreateInput = Omit<Student, 'id' | 'qrCode'>;

export type StudentUpdateInput = Partial<Omit<Student, 'id'>>;

export interface StudentSummary {
  id: string;
  name: string;
  school: string;
  grade: number;
  status: StudentStatus;
  classCount: number;
}

export interface StudentFilter {
  status?: StudentStatus;
  grade?: number;
  school?: string;
  classId?: string;
  search?: string; // 이름/학교 검색
}
