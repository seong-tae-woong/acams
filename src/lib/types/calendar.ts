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
}

export interface MakeupClass {
  id: string;
  originalClassId: string; // 원래 반 ID
  originalClassName: string;
  originalDate: string; // 원래 수업일 (YYYY-MM-DD)
  makeupDate: string; // 보강일 (YYYY-MM-DD)
  makeupTime: string; // 보강 시간 ("HH:MM")
  teacherId: string;
  teacherName: string;
  targetStudents: string[]; // 보강 대상 학생 ID 배열
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
