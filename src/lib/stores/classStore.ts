'use client';
import { create } from 'zustand';
import type { ClassInfo, ClassEvent } from '@/lib/types/class';
import { mockClasses } from '@/lib/mock/classes';

interface ClassStore {
  classes: ClassInfo[];
  selectedClassId: string | null;
  classEvents: ClassEvent[];
  getClass: (id: string) => ClassInfo | undefined;
  setSelectedClass: (id: string | null) => void;
  addClass: (cls: Omit<ClassInfo, 'id' | 'currentStudents'>) => void;
  updateClass: (id: string, updates: Partial<ClassInfo>) => void;
  addClassEvent: (event: Omit<ClassEvent, 'id'>) => void;
  removeClassEvent: (id: string) => void;
}

export const useClassStore = create<ClassStore>((set, get) => ({
  classes: mockClasses,
  selectedClassId: mockClasses[0]?.id ?? null,
  classEvents: [],

  getClass: (id) => get().classes.find((c) => c.id === id),
  setSelectedClass: (id) => set({ selectedClassId: id }),

  addClass: (input) => {
    const id = `c${Date.now()}`;
    const cls: ClassInfo = { ...input, id, currentStudents: 0, students: [] };
    set((state) => ({ classes: [...state.classes, cls], selectedClassId: id }));
  },

  updateClass: (id, updates) => {
    set((state) => ({
      classes: state.classes.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  },

  addClassEvent: (event) => {
    const id = `ce${Date.now()}`;
    set((state) => ({ classEvents: [...state.classEvents, { ...event, id }] }));
  },

  removeClassEvent: (id) => {
    set((state) => ({ classEvents: state.classEvents.filter((e) => e.id !== id) }));
  },
}));
