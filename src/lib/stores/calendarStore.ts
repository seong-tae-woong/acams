'use client';
import { create } from 'zustand';
import type { CalendarEvent } from '@/lib/types/calendar';
import { toast } from '@/lib/stores/toastStore';

interface CalendarStore {
  events: CalendarEvent[];
  loading: boolean;

  // 조회
  getEventsForDate: (dateStr: string) => CalendarEvent[];

  // API 연동 (async)
  fetchEvents: (year: number, month: number) => Promise<void>;
  addEvent: (input: Omit<CalendarEvent, 'id'>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: [],
  loading: false,

  getEventsForDate: (dateStr) => get().events.filter((e) => e.date === dateStr),

  fetchEvents: async (year, month) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('일정 조회 실패');
      const data: CalendarEvent[] = await res.json();
      set({ events: data });
    } catch (err) {
      console.error('[calendarStore.fetchEvents]', err);
      toast('일정을 불러오는 데 실패했습니다.', 'error');
    } finally {
      set({ loading: false });
    }
  },

  addEvent: async (input: Omit<CalendarEvent, 'id'>) => {
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '일정 추가 실패');
      }
      const event: CalendarEvent = await res.json();
      set((state) => ({ events: [...state.events, event] }));
      toast('일정이 추가되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '일정 추가에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },

  deleteEvent: async (id) => {
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('일정 삭제 실패');
      set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
      toast('일정이 삭제되었습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '일정 삭제에 실패했습니다.';
      toast(msg, 'error');
      throw err;
    }
  },
}));
