/**
 * Design token constants and color helpers for AcaMS
 */

export interface StatusColorPair {
  bg: string;
  text: string;
}

export const statusColors: Record<string, StatusColorPair> = {
  // Green — positive / active
  재원: { bg: 'bg-green-100', text: 'text-green-700' },
  출석: { bg: 'bg-green-100', text: 'text-green-700' },
  완납: { bg: 'bg-green-100', text: 'text-green-700' },

  // Yellow — caution / partial
  휴원: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  지각: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  부분납: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  주의: { bg: 'bg-yellow-100', text: 'text-yellow-700' },

  // Red — negative / missing
  퇴원: { bg: 'bg-red-100', text: 'text-red-700' },
  결석: { bg: 'bg-red-100', text: 'text-red-700' },
  미납: { bg: 'bg-red-100', text: 'text-red-700' },
  위험: { bg: 'bg-red-100', text: 'text-red-700' },

  // Blue — informational / in-progress
  조퇴: { bg: 'bg-blue-100', text: 'text-blue-700' },
  진행중: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

/** Fallback for unknown statuses */
const defaultStatusColor: StatusColorPair = {
  bg: 'bg-gray-100',
  text: 'text-gray-700',
};

export function getStatusColor(status: string): StatusColorPair {
  return statusColors[status] ?? defaultStatusColor;
}

/** Rotating avatar background colors (Tailwind classes) */
export const avatarColors: string[] = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-emerald-500',
];

export function getAvatarColor(index: number): string {
  return avatarColors[index % avatarColors.length];
}
