'use client';
import { create } from 'zustand';
import type { AttendanceRecord } from '@/lib/types/attendance';
import { AttendanceStatus } from '@/lib/types/attendance';
import { mockAttendanceRecords } from '@/lib/mock/attendance';

interface AttendanceStore {
  records: AttendanceRecord[];
  selectedDate: string;
  selectedClassId: string | null;
  getRecordsByStudent: (studentId: string, month?: string) => AttendanceRecord[];
  getRecordsByClass: (classId: string, date: string) => AttendanceRecord[];
  setSelectedDate: (date: string) => void;
  setSelectedClass: (id: string | null) => void;
  saveAttendance: (records: Omit<AttendanceRecord, 'id'>[]) => void;
  updateRecord: (id: string, status: AttendanceStatus, memo?: string) => void;
}

const today = new Date().toISOString().split('T')[0];

export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  records: mockAttendanceRecords,
  selectedDate: today,
  selectedClassId: 'c1',

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

  saveAttendance: (inputs) => {
    set((state) => {
      const newRecords = inputs.map((input, i) => ({
        ...input,
        id: `att-new-${Date.now()}-${i}`,
      }));
      return { records: [...state.records, ...newRecords] };
    });
  },

  updateRecord: (id, status, memo) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status, memo: memo ?? r.memo } : r,
      ),
    }));
  },
}));
