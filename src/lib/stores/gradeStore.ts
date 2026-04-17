'use client';
import { create } from 'zustand';
import type { Exam, GradeRecord } from '@/lib/types/grade';
import { mockExams, mockGrades } from '@/lib/mock/grades';

interface GradeStore {
  exams: Exam[];
  grades: GradeRecord[];
  selectedExamId: string | null;
  getExamsByClass: (classId: string) => Exam[];
  getGradesByExam: (examId: string) => GradeRecord[];
  getGradesByStudent: (studentId: string) => GradeRecord[];
  setSelectedExam: (id: string | null) => void;
  addExam: (exam: Omit<Exam, 'id'>) => void;
  saveGrades: (grades: Omit<GradeRecord, 'id'>[]) => void;
}

export const useGradeStore = create<GradeStore>((set, get) => ({
  exams: mockExams,
  grades: mockGrades,
  selectedExamId: mockExams[0]?.id ?? null,

  getExamsByClass: (classId) => get().exams.filter((e) => e.classId === classId),
  getGradesByExam: (examId) => get().grades.filter((g) => g.examId === examId),
  getGradesByStudent: (studentId) => get().grades.filter((g) => g.studentId === studentId),
  setSelectedExam: (id) => set({ selectedExamId: id }),

  addExam: (input) => {
    const exam: Exam = { ...input, id: `e${Date.now()}` };
    set((state) => ({ exams: [...state.exams, exam] }));
  },

  saveGrades: (inputs) => {
    set((state) => {
      const newGrades = inputs.map((input, i) => ({
        ...input,
        id: `gr-new-${Date.now()}-${i}`,
      }));
      return { grades: [...state.grades, ...newGrades] };
    });
  },
}));
