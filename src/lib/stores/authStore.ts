'use client';
import { create } from 'zustand';

export type UserRole = 'director' | 'teacher' | 'parent' | 'student';

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  academyName: string;
  teacherId?: string;
  studentId?: string;
}

interface AuthStore {
  currentUser: CurrentUser;
  setRole: (role: UserRole) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  currentUser: {
    id: 'admin',
    name: '원장',
    role: 'director',
    academyName: '세계로학원',
  },
  setRole: (role) => {
    set((state) => ({ currentUser: { ...state.currentUser, role } }));
  },
}));
