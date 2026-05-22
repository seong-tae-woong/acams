'use client';
import { create } from 'zustand';
import type { Student, StudentListItem } from '@/lib/types/student';
import { StudentStatus } from '@/lib/types/student';
import { toast } from '@/lib/stores/toastStore';

export interface SiblingCandidate {
  id: string;
  name: string;
  school: string;
  grade: number;
  avatarColor: string;
}

interface StudentStore {
  // 목록 (슬림) — 이름 유지, 타입만 StudentListItem[]으로 변경 (22개 소비자 파일 무수정)
  students: StudentListItem[];
  loading: boolean;
  // 선택된 학생 상세
  selectedStudentId: string | null;
  selectedStudent: Student | null;
  detailLoading: boolean;
  // 검색/필터
  filterStatus: StudentStatus | 'all';
  search: string;
  // Getters
  getStudent: (id: string) => StudentListItem | undefined;
  getFilteredStudents: () => StudentListItem[];
  // Actions
  setSelectedStudent: (id: string | null) => Promise<void>;
  setFilterStatus: (status: StudentStatus | 'all') => void;
  setSearch: (search: string) => void;
  // Async API actions
  fetchStudents: () => Promise<void>;
  fetchStudentDetail: (id: string, signal?: AbortSignal) => Promise<void>;
  addStudent: (student: Omit<Student, 'id' | 'qrCode'>) => Promise<{
    studentLoginId: string | null;
    studentTempPassword: string | null;
    parentTempPassword: string | null;
    siblingCandidates: SiblingCandidate[];
  }>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  changeStatus: (id: string, status: StudentStatus) => Promise<void>;
  addStudentToClass: (studentId: string, classId: string) => Promise<void>;
  removeStudentFromClass: (studentId: string, classId: string) => Promise<void>;
  syncSiblings: (studentId: string, newSiblingIds: string[]) => Promise<void>;
}

// AbortController — 빠른 연속 클릭 시 이전 상세 요청 취소
let _detailAbort: AbortController | null = null;

export const useStudentStore = create<StudentStore>((set, get) => ({
  students: [],
  selectedStudentId: null,
  selectedStudent: null,
  detailLoading: false,
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

  setSelectedStudent: async (id) => {
    _detailAbort?.abort();
    if (!id) {
      set({ selectedStudentId: null, selectedStudent: null, detailLoading: false });
      return;
    }
    set({ selectedStudentId: id, detailLoading: true, selectedStudent: null });
    _detailAbort = new AbortController();
    await get().fetchStudentDetail(id, _detailAbort.signal);
  },

  setFilterStatus: (status) => set({ filterStatus: status }),
  setSearch: (search) => set({ search }),

  fetchStudents: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/students');
      if (!res.ok) throw new Error('학생 목록 조회 실패');
      const data: StudentListItem[] = await res.json();
      // 자동 선택 제거 — 자동 선택 시 fetchStudentDetail이 즉시 트리거되어 불필요한 API 호출 발생
      set({ students: data });
    } catch (err) {
      console.error('[studentStore.fetchStudents]', err);
      toast('학생 목록을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  fetchStudentDetail: async (id, signal) => {
    try {
      const res = await fetch(`/api/students/${id}`, { signal });
      if (!res.ok) throw new Error('학생 상세 조회 실패');
      const data: Student = await res.json();
      if (!signal?.aborted) {
        set({ selectedStudent: data, detailLoading: false });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // 취소된 요청은 무시
      toast('학생 정보를 불러오는 데 실패했습니다.', 'error');
      set({ detailLoading: false, selectedStudent: null });
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
      const {
        studentLoginId,
        studentTempPassword,
        parentTempPassword,
        siblingCandidates,
        ...studentFull
      }: Student & {
        studentLoginId: string | null;
        studentTempPassword: string | null;
        parentTempPassword: string | null;
        siblingCandidates: SiblingCandidate[];
      } = await res.json();

      // 목록에 슬림 항목 추가
      const newListItem: StudentListItem = {
        id: studentFull.id,
        name: studentFull.name,
        school: studentFull.school,
        grade: studentFull.grade,
        status: studentFull.status,
        avatarColor: studentFull.avatarColor,
        attendanceNumber: studentFull.attendanceNumber,
        classes: studentFull.classes ?? [],
      };
      set((state) => ({
        students: [...state.students, newListItem],
        selectedStudentId: studentFull.id,
        selectedStudent: studentFull, // 등록 직후 상세 데이터가 이미 있으므로 API 재호출 불필요
      }));
      toast('학생이 등록되었습니다.', 'success');
      return {
        studentLoginId: studentLoginId ?? null,
        studentTempPassword: studentTempPassword ?? null,
        parentTempPassword: parentTempPassword ?? null,
        siblingCandidates: siblingCandidates ?? [],
      };
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
      // 목록(StudentListItem)에는 해당 필드만 반영
      const listUpdates: Partial<StudentListItem> = {
        ...(updated.name !== undefined && { name: updated.name }),
        ...(updated.school !== undefined && { school: updated.school }),
        ...(updated.grade !== undefined && { grade: updated.grade }),
        ...(updated.status !== undefined && { status: updated.status }),
        ...(updated.avatarColor !== undefined && { avatarColor: updated.avatarColor }),
        ...(updated.classes !== undefined && { classes: updated.classes }),
      };
      set((state) => ({
        students: state.students.map((s) =>
          s.id === id ? { ...s, ...listUpdates } : s
        ),
        selectedStudent:
          state.selectedStudent?.id === id ? updated : state.selectedStudent,
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

  syncSiblings: async (studentId, newSiblingIds) => {
    // students(StudentListItem[])에는 siblingIds 없음 → selectedStudent에서 가져옴
    const current = get().selectedStudent?.siblingIds ?? [];
    const toAdd = newSiblingIds.filter((id) => !current.includes(id));
    void toAdd; // 서버에서 처리, 클라이언트는 selectedStudent만 갱신
    try {
      const res = await fetch(`/api/students/${studentId}/siblings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siblingIds: newSiblingIds }),
      });
      if (!res.ok) throw new Error('형제/자매 저장 실패');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '형제/자매 저장에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
    // 목록 패널은 siblingIds 표시 없음 → selectedStudent만 갱신
    set((state) => ({
      selectedStudent:
        state.selectedStudent?.id === studentId
          ? { ...state.selectedStudent, siblingIds: newSiblingIds }
          : state.selectedStudent,
    }));
  },
}));
