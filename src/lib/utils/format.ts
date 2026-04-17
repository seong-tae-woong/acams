/**
 * Korean formatting utilities for AcaMS
 */

function toDate(date: string | Date): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** "2026.04.17" */
export function formatKoreanDate(date: string | Date): string {
  const d = toDate(date);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** "2026.04.17 14:30" */
export function formatKoreanDateTime(date: string | Date): string {
  const d = toDate(date);
  return `${formatKoreanDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "280,000원" */
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** "4,820만원" for large amounts (divides by 10,000) */
export function formatLargeNumber(amount: number): string {
  const man = Math.round(amount / 10000);
  return `${man.toLocaleString('ko-KR')}만원`;
}

/** "010-1234-5678" — handles 10 or 11 digit phone strings */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/** "16:00" — normalises time strings like "1600", "16:00", "4:00 PM" */
export function formatTime(time: string): string {
  const cleaned = time.trim();

  // Already in HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(cleaned)) {
    const [h, m] = cleaned.split(':');
    return `${pad(Number(h))}:${m}`;
  }

  // "1600" → "16:00"
  if (/^\d{4}$/.test(cleaned)) {
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  }

  return cleaned;
}

/** "오늘", "어제", "3일 전", "2주 전", "1개월 전" etc. */
export function getRelativeDate(date: string | Date): string {
  const target = toDate(date);
  const now = new Date();

  // Strip time for day-level comparison
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = todayDay.getTime() - targetDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays === -1) return '내일';

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays < 7) return `${absDays}일 후`;
    if (absDays < 30) return `${Math.floor(absDays / 7)}주 후`;
    return `${Math.floor(absDays / 30)}개월 후`;
  }

  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return `${Math.floor(diffDays / 365)}년 전`;
}

const KOREAN_DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 0=일, 1=월, ... 6=토 */
export function getDayOfWeekKorean(day: number): string {
  return KOREAN_DAYS[day] ?? '';
}
