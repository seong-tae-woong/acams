'use client';
import { create } from 'zustand';
import type { MakeupClass, MakeupAttendance } from '@/lib/types/calendar';
import { toast } from '@/lib/stores/toastStore';

interface MakeupStore {
  makeupClasses: MakeupClass[];
  loading: boolean;
  fetchMakeupClasses: (classId?: string, month?: string) => Promise<void>;
  addMakeupClass: (input: Omit<MakeupClass, 'id' | 'attendanceChecked' | 'originalClassName' | 'teacherName' | 'attendance'> & { originalClassName?: string; teacherName?: string }) => Promise<string>;
  updateMakeupClass: (id: string, updates: Partial<Omit<MakeupClass, 'id'>>) => Promise<void>;
  removeMakeupClass: (id: string) => Promise<void>;
  addStudents: (makeupClassId: string, studentIds: string[]) => Promise<void>;
  removeStudent: (makeupClassId: string, studentId: string) => Promise<void>;
  setAttendanceChecked: (makeupClassId: string, checked: boolean) => Promise<void>;
  saveAttendance: (makeupClassId: string, attendance: MakeupAttendance[]) => Promise<void>;
}

export const useMakeupStore = create<MakeupStore>((set, get) => ({
  makeupClasses: [],
  loading: false,

  fetchMakeupClasses: async (classId, month) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (month) params.set('month', month);
      const res = await fetch(`/api/makeup?${params.toString()}`);
      if (!res.ok) throw new Error('보강 수업 조회 실패');
      const data: MakeupClass[] = await res.json();
      set({ makeupClasses: data });
    } catch (err) {
      console.error('[makeupStore.fetchMakeupClasses]', err);
      toast('보강 수업을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  addMakeupClass: async (input) => {
    try {
      const res = await fetch('/api/makeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalClassId: input.originalClassId,
          originalDate: input.originalDate,
          makeupDate: input.makeupDate,
          makeupTime: input.makeupTime,
          teacherId: input.teacherId,
          reason: input.reason,
          targetStudents: input.targetStudents,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '보강 등록 실패');
      }
      const makeup: MakeupClass = await res.json();
      set((state) => ({ makeupClasses: [...state.makeupClasses, makeup] }));
      toast('보강 수업이 등록되었습니다.', 'success');
      return makeup.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '보강 등록에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  updateMakeupClass: async (id, updates) => {
    try {
      const body: Record<string, unknown> = {};
      if (updates.makeupDate !== undefined) body.makeupDate = updates.makeupDate;
      if (updates.makeupTime !== undefined) body.makeupTime = updates.makeupTime;
      if (updates.teacherId !== undefined) body.teacherId = updates.teacherId;
      if (updates.reason !== undefined) body.reason = updates.reason;
      if (updates.attendanceChecked !== undefined) body.attendanceChecked = updates.attendanceChecked;
      if (updates.targetStudents !== undefined) body.targetStudents = updates.targetStudents;
      if (updates.attendance !== undefined) body.attendance = updates.attendance;

      const res = await fetch(`/api/makeup/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('보강 수정 실패');
      const updated: MakeupClass = await res.json();
      set((state) => ({
        makeupClasses: state.makeupClasses.map((mc) => (mc.id === id ? updated : mc)),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '보강 수정에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  removeMakeupClass: async (id) => {
    try {
      const res = await fetch(`/api/makeup/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('보강 삭제 실패');
      set((state) => ({
        makeupClasses: state.makeupClasses.filter((mc) => mc.id !== id),
      }));
      toast('보강 수업이 삭제되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '보강 삭제에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  addStudents: async (makeupClassId, studentIds) => {
    const mc = get().makeupClasses.find((m) => m.id === makeupClassId);
    if (!mc) return;
    const merged = Array.from(new Set([...mc.targetStudents, ...studentIds]));
    await get().updateMakeupClass(makeupClassId, { targetStudents: merged });
  },

  removeStudent: async (makeupClassId, studentId) => {
    const mc = get().makeupClasses.find((m) => m.id === makeupClassId);
    if (!mc) return;
    const filtered = mc.targetStudents.filter((id) => id !== studentId);
    await get().updateMakeupClass(makeupClassId, { targetStudents: filtered });
  },

  setAttendanceChecked: async (makeupClassId, checked) => {
    await get().updateMakeupClass(makeupClassId, { attendanceChecked: checked });
  },

  saveAttendance: async (makeupClassId, attendance) => {
    await get().updateMakeupClass(makeupClassId, {
      attendance,
      attendanceChecked: true,
    });
  },
}));
