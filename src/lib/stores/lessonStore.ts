'use client';
import { create } from 'zustand';
import type {
  ClinicTemplate,
  ClinicTemplateCreateInput,
  ClinicTemplateUpdateInput,
  LessonSession,
  LessonComment,
  LessonCommentUpsertInput,
  ClinicResult,
  ClinicResultUpsertInput,
  MakeupComment,
  MakeupCommentUpsertInput,
  MakeupClinicResult,
  MakeupClinicResultUpsertInput,
  StudentLessonHistory,
  StudentLessonHistoryQuery,
} from '@/lib/types/lesson';

interface LessonStore {
  templates: ClinicTemplate[];
  sessions: LessonSession[];
  comments: LessonComment[];     // 현재 선택 수업 기준 (정규)
  clinicResults: ClinicResult[]; // 현재 선택 수업 기준 (정규)
  makeupComments: MakeupComment[];          // 현재 선택 보강 기준
  makeupClinicResults: MakeupClinicResult[]; // 현재 선택 보강 기준
  loading: boolean;

  // 양식
  fetchTemplates: () => Promise<void>;
  addTemplate: (input: ClinicTemplateCreateInput) => Promise<ClinicTemplate>;
  updateTemplate: (id: string, input: ClinicTemplateUpdateInput) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>; // soft delete

  // 세션 (캘린더 표시용)
  fetchSessions: (params: { classId?: string; from: string; to: string }) => Promise<void>;

  // 정규 수업 코멘트
  fetchComments: (classId: string, sessionDate: string) => Promise<void>;
  upsertComment: (input: LessonCommentUpsertInput) => Promise<void>;

  // 정규 수업 Clinic 결과
  fetchClinicResults: (classId: string, sessionDate: string) => Promise<void>;
  upsertClinicResult: (input: ClinicResultUpsertInput) => Promise<void>;

  // 보강 수업 코멘트
  fetchMakeupComments: (makeupClassId: string) => Promise<void>;
  upsertMakeupComment: (input: MakeupCommentUpsertInput) => Promise<void>;

  // 보강 수업 Clinic 결과
  fetchMakeupClinicResults: (makeupClassId: string) => Promise<void>;
  upsertMakeupClinicResult: (input: MakeupClinicResultUpsertInput) => Promise<void>;

  // 학생별 수업 이력 (v2)
  studentHistory: StudentLessonHistory | null;
  studentHistoryLoading: boolean;
  fetchStudentHistory: (query: StudentLessonHistoryQuery) => Promise<void>;
  clearStudentHistory: () => void;

  // helpers
  getCommentFor: (classId: string, studentId: string, sessionDate: string) => LessonComment | undefined;
  getClinicResultFor: (
    classId: string,
    studentId: string,
    sessionDate: string,
    templateId: string,
  ) => ClinicResult | undefined;
  getMakeupCommentFor: (makeupClassId: string, studentId: string) => MakeupComment | undefined;
  getMakeupClinicResultFor: (
    makeupClassId: string,
    studentId: string,
    templateId: string,
  ) => MakeupClinicResult | undefined;
}

export const useLessonStore = create<LessonStore>((set, get) => ({
  templates: [],
  sessions: [],
  comments: [],
  clinicResults: [],
  makeupComments: [],
  makeupClinicResults: [],
  loading: false,
  studentHistory: null,
  studentHistoryLoading: false,

  fetchTemplates: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/lessons/clinic-templates');
      if (!res.ok) throw new Error('Clinic 양식 조회 실패');
      const data: ClinicTemplate[] = await res.json();
      set({ templates: data });
    } finally {
      set({ loading: false });
    }
  },

  addTemplate: async (input) => {
    const res = await fetch('/api/lessons/clinic-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Clinic 양식 생성 실패');
    const created: ClinicTemplate = await res.json();
    set((state) => ({ templates: [...state.templates, created] }));
    return created;
  },

  updateTemplate: async (id, input) => {
    const res = await fetch(`/api/lessons/clinic-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Clinic 양식 수정 실패');
    const updated: ClinicTemplate = await res.json();
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTemplate: async (id) => {
    const res = await fetch(`/api/lessons/clinic-templates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Clinic 양식 삭제 실패');
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    }));
  },

  fetchSessions: async ({ classId, from, to }) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      params.set('from', from);
      params.set('to', to);
      const res = await fetch(`/api/lessons/sessions?${params.toString()}`);
      if (!res.ok) throw new Error('수업 일정 조회 실패');
      const data: LessonSession[] = await res.json();
      set({ sessions: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchComments: async (classId, sessionDate) => {
    const params = new URLSearchParams({ classId, date: sessionDate });
    const res = await fetch(`/api/lessons/comments?${params.toString()}`);
    if (!res.ok) throw new Error('수업 코멘트 조회 실패');
    const data: LessonComment[] = await res.json();
    set({ comments: data });
  },

  upsertComment: async (input) => {
    const res = await fetch('/api/lessons/comments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('수업 코멘트 저장 실패');
    const saved: LessonComment = await res.json();
    set((state) => {
      const existing = state.comments.findIndex(
        (c) =>
          c.classId === saved.classId &&
          c.studentId === saved.studentId &&
          c.sessionDate === saved.sessionDate,
      );
      if (existing >= 0) {
        const next = [...state.comments];
        next[existing] = saved;
        return { comments: next };
      }
      return { comments: [...state.comments, saved] };
    });
  },

  fetchClinicResults: async (classId, sessionDate) => {
    const params = new URLSearchParams({ classId, date: sessionDate });
    const res = await fetch(`/api/lessons/clinic-results?${params.toString()}`);
    if (!res.ok) throw new Error('Clinic 결과 조회 실패');
    const data: ClinicResult[] = await res.json();
    set({ clinicResults: data });
  },

  upsertClinicResult: async (input) => {
    const res = await fetch('/api/lessons/clinic-results', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Clinic 결과 저장 실패');
    const saved: ClinicResult = await res.json();
    set((state) => {
      const existing = state.clinicResults.findIndex(
        (r) =>
          r.classId === saved.classId &&
          r.studentId === saved.studentId &&
          r.sessionDate === saved.sessionDate &&
          r.templateId === saved.templateId,
      );
      if (existing >= 0) {
        const next = [...state.clinicResults];
        next[existing] = saved;
        return { clinicResults: next };
      }
      return { clinicResults: [...state.clinicResults, saved] };
    });
  },

  fetchStudentHistory: async ({ studentId, classIds, from, to }) => {
    set({ studentHistoryLoading: true });
    try {
      const params = new URLSearchParams({ studentId, from, to });
      if (classIds && classIds.length > 0) params.set('classIds', classIds.join(','));
      const res = await fetch(`/api/students/lessons/history?${params.toString()}`);
      if (!res.ok) throw new Error('학생 수업 이력 조회 실패');
      const data: StudentLessonHistory = await res.json();
      set({ studentHistory: data });
    } finally {
      set({ studentHistoryLoading: false });
    }
  },

  clearStudentHistory: () => set({ studentHistory: null }),

  getCommentFor: (classId, studentId, sessionDate) =>
    get().comments.find(
      (c) => c.classId === classId && c.studentId === studentId && c.sessionDate === sessionDate,
    ),

  getClinicResultFor: (classId, studentId, sessionDate, templateId) =>
    get().clinicResults.find(
      (r) =>
        r.classId === classId &&
        r.studentId === studentId &&
        r.sessionDate === sessionDate &&
        r.templateId === templateId,
    ),

  // ── 보강 코멘트 ──────────────────────────────────────────
  fetchMakeupComments: async (makeupClassId) => {
    const params = new URLSearchParams({ makeupClassId });
    const res = await fetch(`/api/makeup/comments?${params.toString()}`);
    if (!res.ok) throw new Error('보강 코멘트 조회 실패');
    const data: MakeupComment[] = await res.json();
    set({ makeupComments: data });
  },

  upsertMakeupComment: async (input) => {
    const res = await fetch('/api/makeup/comments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('보강 코멘트 저장 실패');
    const saved: MakeupComment = await res.json();
    set((state) => {
      const idx = state.makeupComments.findIndex(
        (c) => c.makeupClassId === saved.makeupClassId && c.studentId === saved.studentId,
      );
      if (idx >= 0) {
        const next = [...state.makeupComments];
        next[idx] = saved;
        return { makeupComments: next };
      }
      return { makeupComments: [...state.makeupComments, saved] };
    });
  },

  // ── 보강 Clinic 결과 ─────────────────────────────────────
  fetchMakeupClinicResults: async (makeupClassId) => {
    const params = new URLSearchParams({ makeupClassId });
    const res = await fetch(`/api/makeup/clinic-results?${params.toString()}`);
    if (!res.ok) throw new Error('보강 Clinic 결과 조회 실패');
    const data: MakeupClinicResult[] = await res.json();
    set({ makeupClinicResults: data });
  },

  upsertMakeupClinicResult: async (input) => {
    const res = await fetch('/api/makeup/clinic-results', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('보강 Clinic 결과 저장 실패');
    const saved: MakeupClinicResult = await res.json();
    set((state) => {
      const idx = state.makeupClinicResults.findIndex(
        (r) =>
          r.makeupClassId === saved.makeupClassId &&
          r.studentId === saved.studentId &&
          r.templateId === saved.templateId,
      );
      if (idx >= 0) {
        const next = [...state.makeupClinicResults];
        next[idx] = saved;
        return { makeupClinicResults: next };
      }
      return { makeupClinicResults: [...state.makeupClinicResults, saved] };
    });
  },

  getMakeupCommentFor: (makeupClassId, studentId) =>
    get().makeupComments.find(
      (c) => c.makeupClassId === makeupClassId && c.studentId === studentId,
    ),

  getMakeupClinicResultFor: (makeupClassId, studentId, templateId) =>
    get().makeupClinicResults.find(
      (r) =>
        r.makeupClassId === makeupClassId &&
        r.studentId === studentId &&
        r.templateId === templateId,
    ),
}));
