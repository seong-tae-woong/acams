'use client';
import { create } from 'zustand';
import type { Student } from '@/lib/types/student';
import { StudentStatus } from '@/lib/types/student';
import { toast } from '@/lib/stores/toastStore';

interface StudentStore {
  students: Student[];
  selectedStudentId: string | null;
  filterStatus: StudentStatus | 'all';
  search: string;
  loading: boolean;
  // Getters
  getStudent: (id: string) => Student | undefined;
  getFilteredStudents: () => Student[];
  // Actions
  setSelectedStudent: (id: string | null) => void;
  setFilterStatus: (status: StudentStatus | 'all') => void;
  setSearch: (search: string) => void;
  // Async API actions
  fetchStudents: () => Promise<void>;
  addStudent: (student: Omit<Student, 'id' | 'qrCode'>) => Promise<{ tempPasswords: { student: string | null; parent: string | null }; studentLoginId: string | null }>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  changeStatus: (id: string, status: StudentStatus) => Promise<void>;
  addStudentToClass: (studentId: string, classId: string) => Promise<void>;
  removeStudentFromClass: (studentId: string, classId: string) => Promise<void>;
  // TODO: API 미구현 — 새로고침 시 리셋됨
  addSiblingLink: (studentAId: string, studentBId: string) => void;
  syncSiblings: (studentId: string, newSiblingIds: string[]) => void;
}

export const useStudentStore = create<StudentStore>((set, get) => ({
  students: [],
  selectedStudentId: null,
  filterStatus: 'all',
  search: '',
  loading: false,

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

  fetchStudents: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/students');
      if (!res.ok) throw new Error('학생 목록 조회 실패');
      const data: Student[] = await res.json();
      set({ students: data, selectedStudentId: data[0]?.id ?? null });
    } catch (err) {
      console.error('[studentStore.fetchStudents]', err);
      toast('학생 목록을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  addStudent: async (input) => {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '학생 등록 실패');
      }
      const { tempPasswords, studentLoginId, ...student }: Student & { tempPasswords: { student: string | null; parent: string | null }; studentLoginId: string | null } = await res.json();
      set((state) => ({ students: [...state.students, student] }));
      toast('학생이 등록되었습니다.', 'success');
      return { tempPasswords, studentLoginId: studentLoginId ?? null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '학생 등록에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  updateStudent: async (id, updates) => {
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '학생 수정 실패');
      }
      const updated: Student = await res.json();
      set((state) => ({
        students: state.students.map((s) => (s.id === id ? updated : s)),
      }));
      toast('학생 정보가 수정되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '학생 수정에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  changeStatus: async (id, status) => {
    await get().updateStudent(id, { status });
  },

  addStudentToClass: async (studentId, classId) => {
    const student = get().getStudent(studentId);
    if (!student) return;
    const newClasses = [...new Set([...student.classes, classId])];
    await get().updateStudent(studentId, { classes: newClasses });
  },

  removeStudentFromClass: async (studentId, classId) => {
    const student = get().getStudent(studentId);
    if (!student) return;
    const newClasses = student.classes.filter((id) => id !== classId);
    await get().updateStudent(studentId, { classes: newClasses });
  },

  // TODO: 형제/자매 API 미구현 — 다음 버전에서 API화
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
