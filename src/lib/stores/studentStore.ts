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
}));
