'use client';
import { create } from 'zustand';
import type { AttendanceRecord } from '@/lib/types/attendance';
import { toast } from '@/lib/stores/toastStore';

interface AttendanceStore {
  records: AttendanceRecord[];
  loading: boolean;
  getRecordsByStudent: (studentId: string, month?: string) => AttendanceRecord[];
  fetchByStudentMonth: (studentId: string, yearMonth: string) => Promise<void>;
}

export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  records: [],
  loading: false,

  getRecordsByStudent: (studentId, month) => {
    return get().records.filter((r) => {
      const matchStudent = r.studentId === studentId;
      const matchMonth = !month || r.date.startsWith(month);
      return matchStudent && matchMonth;
    });
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
}));
