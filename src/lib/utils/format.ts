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

/** "280,000원" */
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
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

/** "16:00" — normalises time strings like "1600", "16:00" */
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
