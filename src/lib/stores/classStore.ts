'use client';
import { create } from 'zustand';
import type { ClassInfo, ClassEvent } from '@/lib/types/class';
import { toast } from '@/lib/stores/toastStore';

interface ClassStore {
  classes: ClassInfo[];
  selectedClassId: string | null;
  classEvents: ClassEvent[];
  loading: boolean;
  getClass: (id: string) => ClassInfo | undefined;
  setSelectedClass: (id: string | null) => void;
  // Async API actions
  fetchClasses: () => Promise<void>;
  addClass: (cls: Omit<ClassInfo, 'id' | 'currentStudents'>) => Promise<void>;
  updateClass: (id: string, updates: Partial<ClassInfo>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  // ClassEvent — 일회성 수업 일정 (DB 연동)
  fetchClassEvents: () => Promise<void>;
  addClassEvent: (event: Omit<ClassEvent, 'id'>) => Promise<void>;
}

export const useClassStore = create<ClassStore>((set, get) => ({
  classes: [],
  selectedClassId: null,
  classEvents: [],
  loading: false,

  getClass: (id) => get().classes.find((c) => c.id === id),
  setSelectedClass: (id) => set({ selectedClassId: id }),

  fetchClasses: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/classes');
      if (!res.ok) throw new Error('반 목록 조회 실패');
      const data: ClassInfo[] = await res.json();
      set({ classes: data, selectedClassId: data[0]?.id ?? null });
    } catch (err) {
      console.error('[classStore.fetchClasses]', err);
      toast('반 목록을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  addClass: async (input) => {
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '반 추가 실패');
      }
      const cls: ClassInfo = await res.json();
      set((state) => ({ classes: [...state.classes, cls], selectedClassId: cls.id }));
      toast('반이 추가되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '반 추가에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  updateClass: async (id, updates) => {
    try {
      const res = await fetch(`/api/classes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '반 수정 실패');
      }
      const updated: ClassInfo = await res.json();
      set((state) => ({
        classes: state.classes.map((c) => (c.id === id ? updated : c)),
      }));
      toast('반 정보가 수정되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '반 수정에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  deleteClass: async (id) => {
    try {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('반 삭제 실패');
      set((state) => ({
        classes: state.classes.filter((c) => c.id !== id),
        selectedClassId: state.selectedClassId === id ? state.classes[0]?.id ?? null : state.selectedClassId,
      }));
      toast('반이 삭제되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '반 삭제에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  fetchClassEvents: async () => {
    try {
      const res = await fetch('/api/class-events');
      if (!res.ok) throw new Error('일정 조회 실패');
      const data: ClassEvent[] = await res.json();
      set({ classEvents: data });
    } catch (err) {
      console.error('[classStore.fetchClassEvents]', err);
    }
  },

  addClassEvent: async (event) => {
    try {
      const res = await fetch('/api/class-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '일정 추가 실패');
      }
      const created: ClassEvent = await res.json();
      set((state) => ({ classEvents: [...state.classEvents, created] }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '일정 추가에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },
}));
