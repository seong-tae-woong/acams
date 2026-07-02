'use client';
import { create } from 'zustand';

export type UserRole = 'super_admin' | 'director' | 'teacher' | 'parent' | 'student';

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  academyId: string | null;
  academyName: string;
  permissions?: Partial<Record<
    'manageStudents' | 'manageClasses' | 'manageAttendance' | 'manageGrades'
    | 'manageQuestionBank'
    | 'manageFinance' | 'manageNotifications' | 'viewReports' | 'admin', boolean
  >> | null;
}

interface AuthStore {
  currentUser: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,

  hydrate: async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const user: CurrentUser = await res.json();
        set({ currentUser: user, isAuthenticated: true, isLoading: false });
      } else {
        set({ currentUser: null, isAuthenticated: false, isLoading: false });
        // 401 = 토큰이 무효(권한 변경·비밀번호 변경·계정 비활성으로 tokenVersion 불일치).
        // edge proxy는 옛 토큰을 통과시키므로 메뉴가 깨진 채 남는다 → 재로그인으로 정리.
        if (res.status === 401 && typeof window !== 'undefined') {
          const path = window.location.pathname;
          if (path !== '/login' && path !== '/change-password') {
            window.location.href = '/login';
          }
        }
      }
    } catch {
      set({ currentUser: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    set({ currentUser: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  },
}));
