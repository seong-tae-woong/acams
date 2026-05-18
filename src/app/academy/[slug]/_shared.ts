// 학원 공개 페이지 — 공용 타입·디자인 토큰·헬퍼

/* ─────────────────────────────────────────────────
   Types
───────────────────────────────────────────────── */
export type ClassItem = {
  id: string; name: string; subject: string; grade: string;
  fee: number | null; feeType: string; color: string; schedule: string;
  description?: string;
};

// 수강료 단위 표기 — per-lesson(수업 단위)은 "수업", 그 외는 "월"
export function feeUnit(feeType: string): string {
  return feeType === 'per-lesson' ? '수업' : '월';
}
export type CurriculumUnitType = 'MONTH' | 'WEEK' | 'SESSION';
export type CurriculumDetail = {
  id: string; unitType: CurriculumUnitType;
  startWeek: number; endWeek: number;
  topic: string; detail: string;
  color: string | null; done: boolean;
};
export type TextbookDetail = {
  id: string; name: string; publisher: string;
  unit: string; totalUnits: number; currentUnit: number;
  price: number | null;
};
export type CurriculumPalette = 'red' | 'orange' | 'green' | 'custom';
export type ClassDetail = {
  id: string; name: string; subject: string; grade: string;
  fee: number | null; feeType: string; color: string; schedule: string;
  description: string;
  curriculumPalette: CurriculumPalette;
  curriculum: CurriculumDetail[];
  textbooks: TextbookDetail[];
};
export const PALETTE_COLORS: Record<CurriculumPalette, string[]> = {
  red:    ['#ef4444', '#f43f5e', '#ec4899', '#f472b6', '#fb7185', '#fda4af', '#f87171', '#e11d48'],
  orange: ['#f97316', '#fb923c', '#fdba74', '#fbbf24', '#fcd34d', '#facc15', '#eab308', '#f59e0b'],
  green:  ['#10b981', '#22c55e', '#34d399', '#4ade80', '#84cc16', '#a3e635', '#16a34a', '#65a30d'],
  custom: ['#4fc3a1'],
};
export const UNIT_LABELS: Record<CurriculumUnitType, { label: string; suffix: string }> = {
  MONTH:   { label: '월별',   suffix: '월' },
  WEEK:    { label: '주차별', suffix: '주차' },
  SESSION: { label: '차수별', suffix: '차시' },
};
export type AnnouncementItem = {
  id: string; title: string; content: string; publishedAt: string; pinned: boolean;
};
export type Profile = {
  name: string; slug: string; intro: string; phone: string; address: string;
  directorName: string; businessNumber: string; operatingHours: string;
  refundPolicy: string; showFees: boolean; kakaoMapUrl: string;
  galleryImages: string[]; classes: ClassItem[]; announcements: AnnouncementItem[];
};

/* ─────────────────────────────────────────────────
   Design tokens
───────────────────────────────────────────────── */
export const C = {
  heroBg:      '#12103A',   // deep indigo-black
  accent:      '#4F46E5',   // indigo-600
  accentHover: '#4338CA',
  accentLight: '#EEF2FF',
  bg:          '#F7F8FA',
  card:        '#FFFFFF',
  text:        '#111827',
  sub:         '#6B7280',
  muted:       '#9CA3AF',
  border:      '#E5E7EB',
  shadow:      '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.06)',
  shadowMd:    '0 4px 24px rgba(0,0,0,0.10)',
} as const;

export const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
