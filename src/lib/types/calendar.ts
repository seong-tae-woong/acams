// 캘린더 관련 타입 정의

export type CalendarEventType = '학원일정' | '상담일정' | '보강일정' | '휴원일' | '수업';

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
  // 'event' = CalendarEvent 레코드(편집 가능), 'makeup'/'class' = 파생 일정(편집 불가)
  source?: 'event' | 'makeup' | 'class';
}

export interface MakeupAttendance {
  studentId: string;
  status: '출석' | '결석' | '지각' | '조퇴' | null;
  memo: string;
}

export type MakeupSlotType = 'PERSONAL' | 'OPEN';

export interface RecurrencePattern {
  daysOfWeek: number[]; // 1=월..7=일
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime?: string;     // HH:MM (옵션)
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
  // ── 오픈 보강 필드 ──
  slotType?: MakeupSlotType;
  capacity?: number | null;          // null = 무제한
  applicationDeadline?: string | null; // ISO timestamp
  recurrenceGroupId?: string | null;
  // ── 오픈 보강 다중 대상 (학생 공통) ──
  openToAllClasses?: boolean;        // true = 전체 반 신청 가능
  eligibleClassIds?: string[];       // 신청 가능 반 ID (openToAllClasses=false일 때)
  eligibleClassNames?: string[];     // 신청 가능 반 이름 (표시용)
  teacherIds?: string[];             // 담당 강사 ID (0..N)
  teacherNames?: string[];           // 담당 강사 이름 (표시용)
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
