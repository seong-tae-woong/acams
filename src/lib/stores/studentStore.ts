'use client';
import { create } from 'zustand';
import type { Student } from '@/lib/types/student';
import { StudentStatus } from '@/lib/types/student';
import { mockStudents } from '@/lib/mock/students';

interface StudentStore {
  students: Student[];
  selectedStudentId: string | null;
  filterStatus: StudentStatus | 'all';
  search: string;
  // Getters
  getStudent: (id: string) => Student | undefined;
  getFilteredStudents: () => Student[];
  // Actions
  setSelectedStudent: (id: string | null) => void;
  setFilterStatus: (status: StudentStatus | 'all') => void;
  setSearch: (search: string) => void;
  addStudent: (student: Omit<Student, 'id' | 'qrCode'>) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  changeStatus: (id: string, status: StudentStatus) => void;
  addSiblingLink: (studentAId: string, studentBId: string) => void;
  syncSiblings: (studentId: string, newSiblingIds: string[]) => void;
  addStudentToClass: (studentId: string, classId: string) => void;
  removeStudentFromClass: (studentId: string, classId: string) => void;
}

export const useStudentStore = create<StudentStore>((set, get) => ({
  students: mockStudents,
  selectedStudentId: mockStudents[0]?.id ?? null,
  filterStatus: 'all',
  search: '',

  getStudent: (id) => get().students.find((s) => s.id === id),

  getFilteredStudents: () => {
    const { students, filterStatus, search } = get();
    return students.filter((s) => {
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      const matchSearch = !search || s.name.includes(search) || s.school.includes(search);
      return matchStatus && matchSearch;
    });
  },

  setSelectedStudent: (id) => set({ selectedStudentId: id }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setSearch: (search) => set({ search }),

  addStudent: (input) => {
    const id = `s${Date.now()}`;
    const student: Student = {
      ...input,
      id,
      qrCode: `QR-${id}`,
    };
    set((state) => ({ students: [...state.students, student] }));
  },

  updateStudent: (id, updates) => {
    set((state) => ({
      students: state.students.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  changeStatus: (id, status) => {
    set((state) => ({
      students: state.students.map((s) => (s.id === id ? { ...s, status } : s)),
    }));
  },

  addSiblingLink: (studentAId, studentBId) => {
    set((state) => ({
      students: state.students.map((s) => {
        if (s.id === studentAId && !s.siblingIds.includes(studentBId))
          return { ...s, siblingIds: [...s.siblingIds, studentBId] };
        if (s.id === studentBId && !s.siblingIds.includes(studentAId))
          return { ...s, siblingIds: [...s.siblingIds, studentAId] };
        return s;
      }),
    }));
  },

  addStudentToClass: (studentId, classId) => {
    set((state) => ({
      students: state.students.map((s) =>
        s.id === studentId && !s.classes.includes(classId)
          ? { ...s, classes: [...s.classes, classId] }
          : s,
      ),
    }));
  },

  removeStudentFromClass: (studentId, classId) => {
    set((state) => ({
      students: state.students.map((s) =>
        s.id === studentId
          ? { ...s, classes: s.classes.filter((id) => id !== classId) }
          : s,
      ),
    }));
  },

  syncSiblings: (studentId, newSiblingIds) => {
    const current = get().students.find((s) => s.id === studentId)?.siblingIds ?? [];
    const toRemove = current.filter((id) => !newSiblingIds.includes(id));
    const toAdd = newSiblingIds.filter((id) => !current.includes(id));
    set((state) => ({
      students: state.students.map((s) => {
        if (s.id === studentId) return { ...s, siblingIds: newSiblingIds };
        if (toRemove.includes(s.id))
          return { ...s, siblingIds: s.siblingIds.filter((id) => id !== studentId) };
        if (toAdd.includes(s.id) && !s.siblingIds.includes(studentId))
          return { ...s, siblingIds: [...s.siblingIds, studentId] };
        return s;
      }),
    }));
  },
}));
