'use client';
import { create } from 'zustand';
import type { MakeupClass, MakeupAttendance, RecurrencePattern } from '@/lib/types/calendar';
import { toast } from '@/lib/stores/toastStore';

export interface OpenSlotCreateInput {
  originalClassId: string;
  teacherId: string;
  reason?: string;
  capacity?: number | null;
  // 단일 슬롯
  makeupDate?: string;
  makeupTime?: string;
  applicationDeadline?: string | null;
  // 반복 슬롯
  recurrencePattern?: RecurrencePattern;
}

interface MakeupStore {
  makeupClasses: MakeupClass[];
  loading: boolean;
  fetchMakeupClasses: (classId?: string, month?: string, slotType?: 'PERSONAL' | 'OPEN') => Promise<void>;
  addMakeupClass: (input: Omit<MakeupClass, 'id' | 'attendanceChecked' | 'originalClassName' | 'teacherName' | 'attendance'> & { originalClassName?: string; teacherName?: string }) => Promise<string>;
  addOpenSlot: (input: OpenSlotCreateInput) => Promise<{ createdCount: number; excludedCount: number }>;
  updateMakeupClass: (id: string, updates: Partial<Omit<MakeupClass, 'id'>>) => Promise<void>;
  removeMakeupClass: (id: string, scope?: 'this' | 'future') => Promise<{ deletedCount: number }>;
  addStudents: (makeupClassId: string, studentIds: string[]) => Promise<void>;
  removeStudent: (makeupClassId: string, studentId: string) => Promise<void>;
  setAttendanceChecked: (makeupClassId: string, checked: boolean) => Promise<void>;
  saveAttendance: (makeupClassId: string, attendance: MakeupAttendance[]) => Promise<void>;
}

export const useMakeupStore = create<MakeupStore>((set, get) => ({
  makeupClasses: [],
  loading: false,

  fetchMakeupClasses: async (classId, month, slotType) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (month) params.set('month', month);
      if (slotType) params.set('slotType', slotType);
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

  addOpenSlot: async (input) => {
    try {
      const res = await fetch('/api/makeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          slotType: 'OPEN',
          targetStudents: [],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '오픈 슬롯 등록 실패');
      }
      const data = await res.json();
      const createdCount: number = data.createdCount ?? 1;
      const excludedCount: number = data.excludedCount ?? 0;
      // 단일 슬롯이면 makeupClasses에 prepend, 반복이면 refetch가 깔끔
      if (createdCount === 1) {
        set((state) => ({ makeupClasses: [data, ...state.makeupClasses] }));
      }
      const msg = createdCount === 1
        ? '오픈 슬롯이 등록되었습니다.'
        : excludedCount > 0
          ? `${createdCount}개의 슬롯이 생성되었습니다 (휴원일 ${excludedCount}개 자동 제외).`
          : `${createdCount}개의 슬롯이 생성되었습니다.`;
      toast(msg, 'success');
      return { createdCount, excludedCount };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '오픈 슬롯 등록에 실패했습니다.';
      toast(msg, 'error');
      throw err;
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

  removeMakeupClass: async (id, scope = 'this') => {
    try {
      const params = scope === 'future' ? '?scope=future' : '';
      const res = await fetch(`/api/makeup/${id}${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('보강 삭제 실패');
      const data = await res.json();
      const deletedCount: number = data.deletedCount ?? 1;
      // 'this'면 단순 필터, 'future'면 전체 refetch가 안전
      if (scope === 'this') {
        set((state) => ({
          makeupClasses: state.makeupClasses.filter((mc) => mc.id !== id),
        }));
      }
      toast(
        deletedCount === 1
          ? '보강 수업이 삭제되었습니다.'
          : `${deletedCount}개의 보강 슬롯이 삭제되었습니다.`,
        'success',
      );
      return { deletedCount };
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
