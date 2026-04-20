'use client';
import { create } from 'zustand';
import type { Teacher } from '@/lib/types/teacher';
import { mockTeachers } from '@/lib/mock/teachers';

interface TeacherStore {
  teachers: Teacher[];
  addTeacher: (teacher: Omit<Teacher, 'id'>) => void;
  updateTeacher: (id: string, updates: Partial<Omit<Teacher, 'id'>>) => void;
}

export const useTeacherStore = create<TeacherStore>((set) => ({
  teachers: mockTeachers,

  addTeacher: (input) => {
    const id = `t${Date.now()}`;
    const teacher: Teacher = { ...input, id };
    set((state) => ({ teachers: [...state.teachers, teacher] }));
  },

  updateTeacher: (id, updates) => {
    set((state) => ({
      teachers: state.teachers.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },
}));
