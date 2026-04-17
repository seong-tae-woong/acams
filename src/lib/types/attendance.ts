// 출결 관련 타입 정의

export enum AttendanceStatus {
  PRESENT = '출석',
  ABSENT = '결석',
  LATE = '지각',
  EARLY_LEAVE = '조퇴',
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  date: string; // ISO date string (YYYY-MM-DD)
  status: AttendanceStatus;
  checkInTime: string | null; // "HH:MM" or null
  checkOutTime: string | null; // "HH:MM" or null
  memo: string;
  checkedBy: string; // 확인자 (강사 ID 또는 'kiosk')
  checkedAt: string; // ISO datetime string
}

export type KioskCheckInType = '등원' | '하원';

export interface KioskCheckIn {
  studentId: string;
  type: KioskCheckInType;
  timestamp: string; // ISO datetime string
}

export type AttendanceCreateInput = Omit<AttendanceRecord, 'id'>;

export type AttendanceUpdateInput = Partial<Pick<AttendanceRecord, 'status' | 'memo' | 'checkInTime' | 'checkOutTime'>>;

export interface AttendanceSummary {
  studentId: string;
  studentName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  attendanceRate: number; // 0~100 (%)
}

export interface AttendanceFilter {
  classId?: string;
  studentId?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
}

export interface DailyAttendance {
  date: string;
  classId: string;
  className: string;
  records: AttendanceRecord[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    earlyLeave: number;
  };
}
