'use client';
import { create } from 'zustand';
import type { Teacher } from '@/lib/types/teacher';
import { toast } from '@/lib/stores/toastStore';

interface TeacherStore {
  teachers: Teacher[];
  loading: boolean;
  fetchTeachers: () => Promise<void>;
  addTeacher: (teacher: Omit<Teacher, 'id'>) => Promise<{ tempPassword: string }>;
  updateTeacher: (id: string, updates: Partial<Omit<Teacher, 'id'>>) => Promise<void>;
  resetPassword: (id: string) => Promise<{ tempPassword: string; loginId: string }>;
}

export const useTeacherStore = create<TeacherStore>((set, get) => ({
  teachers: [],
  loading: false,

  fetchTeachers: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/teachers');
      if (!res.ok) throw new Error('강사 목록 조회 실패');
      const data: Teacher[] = await res.json();
      set({ teachers: data });
    } catch (err) {
      console.error('[teacherStore.fetchTeachers]', err);
      toast('강사 목록을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  addTeacher: async (input) => {
    try {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '강사 등록 실패');
      }
      const { tempPassword, ...teacher }: Teacher & { tempPassword: string } = await res.json();
      set((state) => ({ teachers: [...state.teachers, teacher] }));
      return { tempPassword };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '강사 등록에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  updateTeacher: async (id, updates) => {
    try {
      const res = await fetch(`/api/teachers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '강사 수정 실패');
      }
      const updated: Teacher = await res.json();
      set((state) => ({
        teachers: state.teachers.map((t) => (t.id === id ? updated : t)),
      }));
      toast('강사 정보가 수정되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '강사 수정에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  resetPassword: async (id) => {
    try {
      const res = await fetch(`/api/teachers/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '비밀번호 초기화 실패');
      }
      const data = await res.json();
      return { tempPassword: data.tempPassword, loginId: data.loginId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '비밀번호 초기화에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },
}));
