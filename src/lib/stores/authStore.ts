'use client';
import { create } from 'zustand';

export type UserRole = 'super_admin' | 'director' | 'teacher' | 'parent' | 'student';

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  academyId: string | null;
  academyName: string;
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
