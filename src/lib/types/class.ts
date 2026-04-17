// 반(클래스) 관련 타입 정의

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=월 ~ 7=일
export const DAY_NAMES: Record<number, string> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일' };

export interface ClassSchedule {
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

export interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  level?: string;
  teacherId: string;
  teacherName: string;
  maxStudents: number;
  currentStudents: number;
  students?: string[]; // 학생 ID 배열
  schedule: ClassSchedule[];
  color: string;   // 시간표 표시 색상 (hex)
  room: string;
  fee: number;     // 월 수강료 (원)
  description: string;
}

export interface ScheduleSlot {
  classId: string;
  className: string;
  teacherName: string;
  room: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  color: string;
  currentStudents: number;
  maxStudents: number;
}

export type ClassCreateInput = Omit<ClassInfo, 'id' | 'currentStudents'>;
export type ClassUpdateInput = Partial<Omit<ClassInfo, 'id'>>;
