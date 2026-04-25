'use client';
import { create } from 'zustand';
import type { AttendanceRecord } from '@/lib/types/attendance';
import { AttendanceStatus } from '@/lib/types/attendance';
import { toast } from '@/lib/stores/toastStore';

interface AttendanceStore {
  records: AttendanceRecord[];
  selectedDate: string;
  selectedClassId: string | null;
  loading: boolean;
  getRecordsByStudent: (studentId: string, month?: string) => AttendanceRecord[];
  getRecordsByClass: (classId: string, date: string) => AttendanceRecord[];
  setSelectedDate: (date: string) => void;
  setSelectedClass: (id: string | null) => void;
  // Async API actions
  fetchByClassDate: (classId: string, date: string) => Promise<void>;
  fetchByStudentMonth: (studentId: string, yearMonth: string) => Promise<void>;
  saveBulk: (classId: string, date: string, records: Omit<AttendanceRecord, 'id' | 'studentName' | 'className' | 'checkedBy' | 'checkedAt'>[]) => Promise<void>;
  updateRecord: (id: string, status: AttendanceStatus, memo?: string) => Promise<void>;
}

const today = new Date().toISOString().split('T')[0];

export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  records: [],
  selectedDate: today,
  selectedClassId: null,
  loading: false,

  getRecordsByStudent: (studentId, month) => {
    return get().records.filter((r) => {
      const matchStudent = r.studentId === studentId;
      const matchMonth = !month || r.date.startsWith(month);
      return matchStudent && matchMonth;
    });
  },

  getRecordsByClass: (classId, date) =>
    get().records.filter((r) => r.classId === classId && r.date === date),

  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedClass: (id) => set({ selectedClassId: id }),

  fetchByClassDate: async (classId, date) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/attendance?classId=${classId}&date=${date}`);
      if (!res.ok) throw new Error('출결 조회 실패');
      const data: AttendanceRecord[] = await res.json();
      // 해당 반+날짜 레코드만 교체, 나머지 유지
      set((state) => ({
        records: [
          ...state.records.filter((r) => !(r.classId === classId && r.date === date)),
          ...data,
        ],
      }));
    } catch (err) {
      console.error('[attendanceStore.fetchByClassDate]', err);
      toast('출결 정보를 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  fetchByStudentMonth: async (studentId, yearMonth) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/attendance?studentId=${studentId}&month=${yearMonth}`);
      if (!res.ok) throw new Error('출결 조회 실패');
      const data: AttendanceRecord[] = await res.json();
      // 해당 학생+월 레코드만 교체
      set((state) => ({
        records: [
          ...state.records.filter(
            (r) => !(r.studentId === studentId && r.date.startsWith(yearMonth))
          ),
          ...data,
        ],
      }));
    } catch (err) {
      console.error('[attendanceStore.fetchByStudentMonth]', err);
      toast('출결 정보를 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  saveBulk: async (classId, date, inputs) => {
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          date,
          records: inputs,
        }),
      });
      if (!res.ok) throw new Error('출결 저장 실패');
      const saved: AttendanceRecord[] = await res.json();
      set((state) => ({
        records: [
          ...state.records.filter((r) => !(r.classId === classId && r.date === date)),
          ...saved,
        ],
      }));
      toast('출결이 저장되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '출결 저장에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  updateRecord: async (id, status, memo) => {
    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, memo }),
      });
      if (!res.ok) throw new Error('출결 수정 실패');
      const updated: AttendanceRecord = await res.json();
      set((state) => ({
        records: state.records.map((r) => (r.id === id ? updated : r)),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '출결 수정에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  // saveAttendance 하위호환 (기존 페이지에서 사용 중일 수 있음)
  saveAttendance: (inputs: Omit<AttendanceRecord, 'id'>[]) => {
    // saveBulk로 마이그레이션 필요 — 호환용 로컬 처리
    set((state) => {
      const newRecords = inputs.map((input, i) => ({
        ...input,
        id: `att-new-${Date.now()}-${i}`,
      }));
      return { records: [...state.records, ...newRecords] };
    });
  },
}));
