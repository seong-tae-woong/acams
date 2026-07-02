// 반 편성 및 시간표 — 공용 상수·타입·헬퍼

import type { FeeType, CurriculumPalette } from '@/lib/types/class';
import { CURRICULUM_PALETTES } from '@/lib/types/class';

export const FEE_TYPES: FeeType[] = ['monthly', 'per-lesson'];
export const PRESET_COLORS = ['#4fc3a1', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#f97316', '#ec4899'];
export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export const CLASS_DETAIL_TABS = [
  { value: 'schedule', label: '시간표 / 수강생' },
  { value: 'teacher', label: '강사 정보' },
  { value: 'curriculum', label: '교재/커리큘럼' },
];

// ── 커리큘럼/교재 타입 ──────────────────────────────────
export interface Textbook {
  id: string; classId: string; name: string; publisher: string;
  unit: string; totalUnits: number; price: number; currentUnit: number;
  isbn: string; purchaseDate: string; memo: string;
}
export type CurriculumUnitType = 'MONTH' | 'WEEK' | 'SESSION';
export interface CurriculumRow {
  id: string; unitType: CurriculumUnitType;
  startWeek: number; endWeek: number;
  topic: string; detail: string;
  color: string | null;
  done: boolean;
}
export const UNIT_TYPE_OPTIONS: { value: CurriculumUnitType; label: string; suffix: string }[] = [
  { value: 'MONTH', label: '월별', suffix: '월' },
  { value: 'WEEK', label: '주차별', suffix: '주차' },
  { value: 'SESSION', label: '차수별', suffix: '차시' },
];
export const unitSuffix = (t: CurriculumUnitType) => UNIT_TYPE_OPTIONS.find((u) => u.value === t)?.suffix ?? '주차';

// 팔레트 + 인덱스로 막대 색 자동 부여 (직접 지정된 color가 우선)
export function resolveBarColor(row: CurriculumRow, indexInGroup: number, palette: CurriculumPalette): string {
  if (row.color) return row.color;
  const colors = CURRICULUM_PALETTES[palette]?.colors ?? CURRICULUM_PALETTES.green.colors;
  return colors[indexInGroup % colors.length];
}

export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const PERMISSION_LABELS: Record<string, string> = {
  manageStudents: '학생 관리',
  manageClasses: '반 관리',
  manageAttendance: '출결 관리',
  manageGrades: '수업 관리',
  manageQuestionBank: '문제 출제',
  manageFinance: '재무 관리',
  manageNotifications: '알림/공지',
  viewReports: '리포트 조회',
  admin: '전체 관리자',
};
