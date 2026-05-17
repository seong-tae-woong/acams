'use client';
import { create } from 'zustand';
import type { Exam, ExamCategory, GradeRecord } from '@/lib/types/grade';

interface GradeStore {
  exams: Exam[];
  grades: GradeRecord[];
  categories: ExamCategory[];
  selectedExamId: string | null;
  loading: boolean;

  // 조회
  getExamsByClass: (classId: string) => Exam[];
  getGradesByExam: (examId: string) => GradeRecord[];
  setSelectedExam: (id: string | null) => void;

  // API 연동 (async)
  // opts.take 지정 시 등록일 최신순 페이지네이션 (append=true면 기존 목록에 누적). 반환값 = 이번에 받은 개수
  fetchExams: (
    classId?: string,
    opts?: {
      take?: number;
      skip?: number;
      append?: boolean;
      category1Id?: string;
      category2Id?: string;
      category3Id?: string;
    },
  ) => Promise<number>;
  fetchGrades: (examId: string) => Promise<void>;
  addExam: (exam: Omit<Exam, 'id'>) => Promise<string>;
  updateExam: (id: string, updates: Partial<Omit<Exam, 'id' | 'classId' | 'className' | 'subject'>>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  saveGrades: (grades: Omit<GradeRecord, 'id'>[]) => Promise<void>;
  updateGrade: (id: string, updates: Partial<Pick<GradeRecord, 'score' | 'rank' | 'memo'>>) => Promise<void>;

  // 카테고리
  fetchCategories: () => Promise<void>;
  addCategory: (input: { name: string; level: 1 | 2 | 3; parentId: string | null }) => Promise<ExamCategory>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useGradeStore = create<GradeStore>((set, get) => ({
  exams: [],
  grades: [],
  categories: [],
  selectedExamId: null,
  loading: false,

  getExamsByClass: (classId) => get().exams.filter((e) => e.classId === classId),
  getGradesByExam: (examId) => get().grades.filter((g) => g.examId === examId),
  setSelectedExam: (id) => set({ selectedExamId: id }),

  fetchExams: async (classId, opts) => {
    // append(추가 로딩) 시에는 전체 로딩 스피너를 띄우지 않음
    if (!opts?.append) set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (opts?.category1Id) params.set('category1Id', opts.category1Id);
      if (opts?.category2Id) params.set('category2Id', opts.category2Id);
      if (opts?.category3Id) params.set('category3Id', opts.category3Id);
      if (opts?.take !== undefined) {
        params.set('take', String(opts.take));
        params.set('skip', String(opts.skip ?? 0));
      }
      const qs = params.toString();
      const res = await fetch(`/api/exams${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('시험 목록 조회 실패');
      const data: Exam[] = await res.json();
      set((state) => ({ exams: opts?.append ? [...state.exams, ...data] : data }));
      return data.length;
    } finally {
      if (!opts?.append) set({ loading: false });
    }
  },

  fetchGrades: async (examId) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/grades?examId=${examId}`);
      if (!res.ok) throw new Error('성적 조회 실패');
      const data: GradeRecord[] = await res.json();
      // 해당 examId 성적만 교체, 다른 exam 성적은 유지
      set((state) => ({
        grades: [
          ...state.grades.filter((g) => g.examId !== examId),
          ...data,
        ],
      }));
    } finally {
      set({ loading: false });
    }
  },

  addExam: async (input) => {
    const res = await fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? '시험 등록 실패');
    }
    const exam: Exam = await res.json();
    set((state) => ({ exams: [...state.exams, exam] }));
    return exam.id;
  },

  updateExam: async (id, updates) => {
    const res = await fetch(`/api/exams/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? '시험 수정 실패');
    }
    const exam: Exam = await res.json();
    set((state) => ({ exams: state.exams.map((e) => (e.id === id ? exam : e)) }));
  },

  deleteExam: async (id) => {
    const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('시험 삭제 실패');
    set((state) => ({
      exams: state.exams.filter((e) => e.id !== id),
      grades: state.grades.filter((g) => g.examId !== id),
      selectedExamId: state.selectedExamId === id ? null : state.selectedExamId,
    }));
  },

  saveGrades: async (inputs) => {
    const res = await fetch('/api/grades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    if (!res.ok) throw new Error('성적 저장 실패');
    // 저장 후 해당 examId의 성적을 서버에서 다시 가져옴
    if (inputs.length > 0) {
      await get().fetchGrades(inputs[0].examId);
    }
  },

  updateGrade: async (id, updates) => {
    // 낙관적 업데이트 (UI 즉시 반응)
    set((state) => ({
      grades: state.grades.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    }));
    const res = await fetch(`/api/grades/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      // 실패 시 서버 데이터로 복원
      const grade = get().grades.find((g) => g.id === id);
      if (grade) await get().fetchGrades(grade.examId);
      throw new Error('성적 수정 실패');
    }
  },

  fetchCategories: async () => {
    const res = await fetch('/api/exam-categories');
    if (!res.ok) throw new Error('카테고리 조회 실패');
    const data: ExamCategory[] = await res.json();
    set({ categories: data });
  },

  addCategory: async (input) => {
    const res = await fetch('/api/exam-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? '카테고리 등록 실패');
    }
    const cat: ExamCategory = await res.json();
    set((state) => ({ categories: [...state.categories, cat] }));
    return cat;
  },

  deleteCategory: async (id) => {
    const res = await fetch(`/api/exam-categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? '카테고리 삭제 실패');
    }
    // 자식까지 서버에서 함께 지웠으므로 다시 가져옴
    await get().fetchCategories();
    // 카테고리 삭제 시 해당 카테고리를 쓰던 시험은 슬롯이 null이 되었으니 시험도 다시 조회
    const exams = get().exams;
    const classIds = Array.from(new Set(exams.map((e) => e.classId)));
    if (classIds.length === 1) {
      await get().fetchExams(classIds[0]);
    }
  },
}));
