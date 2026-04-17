// AcaMS 타입 정의 - 전체 재출력 (Re-export)

// Student
export {
  StudentStatus,
  type Student,
  type StudentCreateInput,
  type StudentUpdateInput,
  type StudentSummary,
  type StudentFilter,
} from './student';

// Class / Schedule
export {
  type DayOfWeek,
  DAY_NAMES,
  type ClassSchedule,
  type ClassInfo,
  type ScheduleSlot,
  type ClassCreateInput,
  type ClassUpdateInput,
} from './class';

// Attendance
export {
  AttendanceStatus,
  type AttendanceRecord,
  type KioskCheckInType,
  type KioskCheckIn,
  type AttendanceCreateInput,
  type AttendanceUpdateInput,
  type AttendanceSummary,
  type AttendanceFilter,
  type DailyAttendance,
} from './attendance';

// Grade / Exam
export {
  type AttitudeGrade,
  type Exam,
  type GradeRecord,
  type StudentReport,
  type ReportScore,
  type ReportAttitude,
  type ExamCreateInput,
  type GradeCreateInput,
  type GradeUpdateInput,
  type ExamSummary,
  type GradeFilter,
} from './grade';

// Finance
export {
  type PaymentMethod,
  BillStatus,
  type Bill,
  type Expense,
  type Receipt,
  type BillCreateInput,
  type BillPaymentInput,
  type ExpenseCreateInput,
  type BillFilter,
  type FinanceSummary,
  type StudentBillSummary,
} from './finance';

// Teacher
export {
  type TeacherPermissions,
  type Teacher,
  type TeacherCreateInput,
  type TeacherUpdateInput,
  type TeacherSummary,
  type TeacherFilter,
  DEFAULT_PERMISSIONS,
} from './teacher';

// Notification / Communication
export {
  type NotificationType,
  type Notification,
  type ConsultationType,
  type ConsultationRecord,
  type AnnouncementStatus,
  type AnnouncementAttachment,
  type Announcement,
  type NotificationCreateInput,
  type ConsultationCreateInput,
  type AnnouncementCreateInput,
  type NotificationFilter,
  type ConsultationFilter,
} from './notification';

// Calendar
export {
  type CalendarEventType,
  type CalendarEvent,
  type MakeupClass,
  type CalendarEventCreateInput,
  type MakeupClassCreateInput,
  type CalendarFilter,
  type MonthlyCalendarView,
} from './calendar';
