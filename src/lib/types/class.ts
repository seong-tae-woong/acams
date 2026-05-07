// 반(클래스) 관련 타입 정의

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=월 ~ 7=일
export const DAY_NAMES: Record<number, string> = { 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일' };

export interface ClassSchedule {
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

export type FeeType = 'monthly' | 'per-lesson';

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  monthly: '원/월',
  'per-lesson': '원/수업',
};

export const FEE_TYPE_NAMES: Record<FeeType, string> = {
  monthly: '월 단위',
  'per-lesson': '수업 단위',
};

export type CurriculumPalette = 'red' | 'orange' | 'green' | 'custom';

export const CURRICULUM_PALETTES: Record<CurriculumPalette, { label: string; colors: string[] }> = {
  red: { label: '빨강 → 분홍', colors: ['#ef4444', '#f43f5e', '#ec4899', '#f472b6', '#fb7185', '#fda4af', '#f87171', '#e11d48'] },
  orange: { label: '주황 → 노랑', colors: ['#f97316', '#fb923c', '#fdba74', '#fbbf24', '#fcd34d', '#facc15', '#eab308', '#f59e0b'] },
  green: { label: '초록 → 연두', colors: ['#10b981', '#22c55e', '#34d399', '#4ade80', '#84cc16', '#a3e635', '#16a34a', '#65a30d'] },
  custom: { label: '직접 지정', colors: ['#4fc3a1'] },
};

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
  fee: number;     // 수강료 (원)
  feeType: FeeType; // 수강료 단위
  description: string;
  curriculumPalette?: CurriculumPalette;
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

// 날짜 지정 일회성 수업 일정
export interface ClassEvent {
  id: string;
  classId: string;
  date: string;       // 'YYYY-MM-DD'
  startTime: string;  // 'HH:MM'
  endTime: string;    // 'HH:MM'
}
