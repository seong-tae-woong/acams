'use client';
import { create } from 'zustand';
import type { Notification, ConsultationRecord, Announcement } from '@/lib/types/notification';
import { toast } from '@/lib/stores/toastStore';

interface CommunicationStore {
  notifications: Notification[];
  consultations: ConsultationRecord[];
  announcements: Announcement[];
  loading: boolean;

  fetchNotifications: () => Promise<void>;
  fetchConsultations: (studentId?: string) => Promise<void>;
  fetchAnnouncements: () => Promise<void>;

  getConsultationsByStudent: (studentId: string) => ConsultationRecord[];

  addNotification: (n: Omit<Notification, 'id' | 'sentAt' | 'readCount' | 'totalCount'>) => Promise<void>;
  addConsultation: (c: Omit<ConsultationRecord, 'id'>) => Promise<void>;
  addAnnouncement: (a: Omit<Announcement, 'id' | 'createdAt' | 'publishedAt' | 'readCount' | 'totalCount'>) => Promise<void>;
  publishAnnouncement: (id: string) => Promise<void>;
}

export const useCommunicationStore = create<CommunicationStore>((set, get) => ({
  notifications: [],
  consultations: [],
  announcements: [],
  loading: false,

  fetchNotifications: async () => {
    try {
      const res = await fetch('/api/communication/notifications');
      if (!res.ok) throw new Error('알림 목록 조회 실패');
      const data: Notification[] = await res.json();
      set({ notifications: data });
    } catch (err) {
      console.error('[communicationStore.fetchNotifications]', err);
      toast('알림 목록을 불러오는 데 실패했습니다.', 'error');
    }
  },

  fetchConsultations: async (studentId?: string) => {
    try {
      const url = studentId
        ? `/api/communication/consultations?studentId=${studentId}`
        : '/api/communication/consultations';
      const res = await fetch(url);
      if (!res.ok) throw new Error('상담 기록 조회 실패');
      const data: ConsultationRecord[] = await res.json();
      set({ consultations: data });
    } catch (err) {
      console.error('[communicationStore.fetchConsultations]', err);
      toast('상담 기록을 불러오는 데 실패했습니다.', 'error');
    }
  },

  fetchAnnouncements: async () => {
    try {
      const res = await fetch('/api/communication/announcements');
      if (!res.ok) throw new Error('공지사항 조회 실패');
      const data: Announcement[] = await res.json();
      set({ announcements: data });
    } catch (err) {
      console.error('[communicationStore.fetchAnnouncements]', err);
      toast('공지사항을 불러오는 데 실패했습니다.', 'error');
    }
  },

  getConsultationsByStudent: (studentId) =>
    get().consultations.filter((c) => c.studentId === studentId),

  addNotification: async (input) => {
    try {
      const res = await fetch('/api/communication/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('알림 발송 실패');
      const n: Notification = await res.json();
      set((state) => ({ notifications: [n, ...state.notifications] }));
      toast('알림이 발송되었습니다.', 'success');
    } catch (err) {
      console.error('[communicationStore.addNotification]', err);
      toast('알림 발송에 실패했습니다.', 'error');
    }
  },

  addConsultation: async (input) => {
    try {
      const res = await fetch('/api/communication/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('상담 등록 실패');
      const c: ConsultationRecord = await res.json();
      set((state) => ({ consultations: [c, ...state.consultations] }));
      toast('상담 기록이 등록되었습니다.', 'success');
    } catch (err) {
      console.error('[communicationStore.addConsultation]', err);
      toast('상담 등록에 실패했습니다.', 'error');
    }
  },

  addAnnouncement: async (input) => {
    try {
      const res = await fetch('/api/communication/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('공지 등록 실패');
      const a: Announcement = await res.json();
      set((state) => ({ announcements: [a, ...state.announcements] }));
      toast('공지사항이 등록되었습니다.', 'success');
    } catch (err) {
      console.error('[communicationStore.addAnnouncement]', err);
      toast('공지 등록에 실패했습니다.', 'error');
    }
  },

  publishAnnouncement: async (id) => {
    try {
      const res = await fetch(`/api/communication/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '게시됨' }),
      });
      if (!res.ok) throw new Error('공지 게시 실패');
      const updated: Announcement = await res.json();
      set((state) => ({
        announcements: state.announcements.map((a) => (a.id === id ? updated : a)),
      }));
      toast('공지사항이 게시되었습니다.', 'success');
    } catch (err) {
      console.error('[communicationStore.publishAnnouncement]', err);
      toast('공지 게시에 실패했습니다.', 'error');
    }
  },
}));
