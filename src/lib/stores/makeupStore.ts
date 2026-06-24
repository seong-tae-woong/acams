'use client';
import { create } from 'zustand';
import type { MakeupClass, MakeupAttendance, RecurrencePattern } from '@/lib/types/calendar';
import { toast } from '@/lib/stores/toastStore';

export interface OpenSlotCreateInput {
  // 오픈 보강 다중 대상 (대표 반/강사는 서버에서 산정)
  openToAllClasses?: boolean;
  eligibleClassIds?: string[];
  teacherIds?: string[];
  reason?: string;
  capacity?: number | null;
  // 단일 슬롯
  makeupDate?: string;
  makeupTime?: string;
  applicationDeadline?: string | null;
  // 반복 슬롯
  recurrencePattern?: RecurrencePattern;
}

export type SlotType = 'PERSONAL' | 'OPEN';

export interface MakeupFilters {
  classId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

interface TabState {
  items: MakeupClass[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  filters: MakeupFilters;
}

const EMPTY_TAB: TabState = {
  items: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  filters: {},
};

const PAGE_SIZE = 10;

interface MakeupStore {
  personal: TabState;
  open: TabState;

  /** 보강 목록 첫 페이지 로드 (filters를 새로 설정하고 cursor 초기화). */
  fetchMakeupClasses: (slotType: SlotType, filters?: MakeupFilters) => Promise<void>;
  /** 다음 페이지를 현재 리스트에 append. */
  fetchMore: (slotType: SlotType) => Promise<void>;

  addMakeupClass: (input: Omit<MakeupClass, 'id' | 'attendanceChecked' | 'originalClassName' | 'teacherName' | 'attendance'> & { originalClassName?: string; teacherName?: string }) => Promise<string>;
  addOpenSlot: (input: OpenSlotCreateInput) => Promise<{ createdCount: number; excludedCount: number }>;
  updateMakeupClass: (id: string, updates: Partial<Omit<MakeupClass, 'id'>>) => Promise<void>;
  removeMakeupClass: (id: string, scope?: 'this' | 'future') => Promise<{ deletedCount: number }>;
  addStudents: (makeupClassId: string, studentIds: string[]) => Promise<void>;
  removeStudent: (makeupClassId: string, studentId: string) => Promise<void>;
  setAttendanceChecked: (makeupClassId: string, checked: boolean) => Promise<void>;
  saveAttendance: (makeupClassId: string, attendance: MakeupAttendance[]) => Promise<void>;
}

function tabKey(slotType: SlotType): 'personal' | 'open' {
  return slotType === 'OPEN' ? 'open' : 'personal';
}

function buildQuery(slotType: SlotType, filters: MakeupFilters, cursor: string | null): string {
  const params = new URLSearchParams();
  params.set('slotType', slotType);
  if (filters.classId) params.set('classId', filters.classId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(PAGE_SIZE));
  return params.toString();
}

export const useMakeupStore = create<MakeupStore>((set, get) => ({
  personal: EMPTY_TAB,
  open: EMPTY_TAB,

  fetchMakeupClasses: async (slotType, filters = {}) => {
    const key = tabKey(slotType);
    set((state) => ({
      [key]: { ...state[key], loading: true, filters, items: [], nextCursor: null },
    }));
    try {
      const res = await fetch(`/api/makeup?${buildQuery(slotType, filters, null)}`);
      if (!res.ok) throw new Error('보강 수업 조회 실패');
      const data: { items: MakeupClass[]; nextCursor: string | null } = await res.json();
      set((state) => ({
        [key]: { ...state[key], items: data.items, nextCursor: data.nextCursor, loading: false },
      }));
    } catch (err) {
      console.error('[makeupStore.fetchMakeupClasses]', err);
      toast('보강 수업을 불러오는 데 실패했습니다.', 'error');
      set((state) => ({ [key]: { ...state[key], loading: false } }));
    }
  },

  fetchMore: async (slotType) => {
    const key = tabKey(slotType);
    const tab = get()[key];
    if (!tab.nextCursor || tab.loading || tab.loadingMore) return;
    set((state) => ({ [key]: { ...state[key], loadingMore: true } }));
    try {
      const res = await fetch(`/api/makeup?${buildQuery(slotType, tab.filters, tab.nextCursor)}`);
      if (!res.ok) throw new Error('보강 수업 추가 조회 실패');
      const data: { items: MakeupClass[]; nextCursor: string | null } = await res.json();
      set((state) => ({
        [key]: {
          ...state[key],
          items: [...state[key].items, ...data.items],
          nextCursor: data.nextCursor,
          loadingMore: false,
        },
      }));
    } catch (err) {
      console.error('[makeupStore.fetchMore]', err);
      toast('보강 수업을 추가로 불러오는 데 실패했습니다.', 'error');
      set((state) => ({ [key]: { ...state[key], loadingMore: false } }));
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
      // 단일 슬롯이면 open list에 prepend, 반복이면 refetch가 깔끔
      if (createdCount === 1) {
        set((state) => ({ open: { ...state.open, items: [data, ...state.open.items] } }));
      } else {
        await get().fetchMakeupClasses('OPEN', get().open.filters);
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
      // 개별 보강 리스트에 prepend (정렬은 makeupDate desc이지만 새로 등록한 건 상단에 두어 즉시 확인 가능하게)
      set((state) => ({
        personal: { ...state.personal, items: [makeup, ...state.personal.items] },
      }));
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
      // 두 리스트 모두에서 해당 id를 찾아 교체 (slotType은 record에 들어있음)
      set((state) => ({
        personal: {
          ...state.personal,
          items: state.personal.items.map((mc) => (mc.id === id ? updated : mc)),
        },
        open: {
          ...state.open,
          items: state.open.items.map((mc) => (mc.id === id ? updated : mc)),
        },
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
      if (scope === 'this') {
        set((state) => ({
          personal: { ...state.personal, items: state.personal.items.filter((mc) => mc.id !== id) },
          open: { ...state.open, items: state.open.items.filter((mc) => mc.id !== id) },
        }));
      } else {
        // future 범위는 같은 recurrenceGroupId의 여러 row가 한 번에 삭제되므로 refetch가 안전.
        await get().fetchMakeupClasses('OPEN', get().open.filters);
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
    const mc =
      get().personal.items.find((m) => m.id === makeupClassId) ??
      get().open.items.find((m) => m.id === makeupClassId);
    if (!mc) return;
    const merged = Array.from(new Set([...mc.targetStudents, ...studentIds]));
    await get().updateMakeupClass(makeupClassId, { targetStudents: merged });
  },

  removeStudent: async (makeupClassId, studentId) => {
    const mc =
      get().personal.items.find((m) => m.id === makeupClassId) ??
      get().open.items.find((m) => m.id === makeupClassId);
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
