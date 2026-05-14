// 캘린더 관련 타입 정의

export type CalendarEventType = '학원일정' | '상담일정' | '보강일정';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: string | null; // "HH:MM" or null for all-day
  endTime: string | null; // "HH:MM" or null for all-day
  type: CalendarEventType;
  isPublic: boolean; // 학부모 공개 여부
  description: string;
  color: string; // hex color
  relatedStudentId: string | null; // 관련 학생 (상담 등, 없으면 null)
  classId?: string | null;   // 반 지정 (null = 전체)
  className?: string | null; // 반 이름 (읽기용)
}

export interface MakeupAttendance {
  studentId: string;
  status: '출석' | '결석' | '지각' | '조퇴' | null;
  memo: string;
}

export interface MakeupClass {
  id: string;
  originalClassId: string; // 원래 반 ID
  originalClassName: string;
  originalDate: string; // 원래 수업일 (YYYY-MM-DD)
  originalStartTime?: string | null; // 원래 수업 시작 시간 ("HH:MM")
  originalEndTime?: string | null;   // 원래 수업 종료 시간 ("HH:MM")
  makeupDate: string; // 보강일 (YYYY-MM-DD)
  makeupTime: string; // 보강 시간 ("HH:MM")
  teacherId: string;
  teacherName: string;
  targetStudents: string[]; // 보강 대상 학생 ID 배열
  attendance?: MakeupAttendance[]; // 학생별 출결
  reason: string;
  attendanceChecked: boolean; // 출결 확인 완료 여부
}

export type CalendarEventCreateInput = Omit<CalendarEvent, 'id'>;

export type MakeupClassCreateInput = Omit<MakeupClass, 'id' | 'attendanceChecked'>;

export interface CalendarFilter {
  dateFrom?: string;
  dateTo?: string;
  type?: CalendarEventType;
  isPublic?: boolean;
}

export interface MonthlyCalendarView {
  year: number;
  month: number; // 1~12
  events: CalendarEvent[];
  makeupClasses: MakeupClass[];
}
