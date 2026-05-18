// 계정 관리(설정) — 공용 상수·타입

import { DEFAULT_PERMISSIONS } from '@/lib/types/teacher';

export const PERM_LABELS: Record<keyof typeof DEFAULT_PERMISSIONS, string> = {
  manageStudents: '학생 관리',
  manageClasses: '반 관리',
  manageAttendance: '출결 관리',
  manageGrades: '성적 관리',
  manageFinance: '재무 관리',
  manageNotifications: '알림/공지',
  viewReports: '리포트 조회',
  admin: '전체 관리자',
};

export const AVATAR_COLORS = ['#ef4444', '#4fc3a1', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#ec4899'];
export const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

export type SettingsTab = 'teachers' | 'academy' | 'profile' | 'tablet';

export type TabletUser = { id: string; name: string; loginId: string; isActive: boolean; createdAt: string };
