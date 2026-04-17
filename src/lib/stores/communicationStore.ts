'use client';
import { create } from 'zustand';
import type { Notification, ConsultationRecord, Announcement } from '@/lib/types/notification';
import { mockNotifications, mockConsultations, mockAnnouncements } from '@/lib/mock/notifications';

interface CommunicationStore {
  notifications: Notification[];
  consultations: ConsultationRecord[];
  announcements: Announcement[];
  getConsultationsByStudent: (studentId: string) => ConsultationRecord[];
  addNotification: (n: Omit<Notification, 'id' | 'sentAt' | 'readCount' | 'totalCount'>) => void;
  addConsultation: (c: Omit<ConsultationRecord, 'id'>) => void;
  addAnnouncement: (a: Omit<Announcement, 'id' | 'createdAt' | 'publishedAt' | 'readCount' | 'totalCount'>) => void;
  publishAnnouncement: (id: string) => void;
}

export const useCommunicationStore = create<CommunicationStore>((set, get) => ({
  notifications: mockNotifications,
  consultations: mockConsultations,
  announcements: mockAnnouncements,

  getConsultationsByStudent: (studentId) =>
    get().consultations.filter((c) => c.studentId === studentId),

  addNotification: (input) => {
    const n: Notification = {
      ...input,
      id: `n${Date.now()}`,
      sentAt: new Date().toISOString(),
      readCount: 0,
      totalCount: input.recipients.length,
    };
    set((state) => ({ notifications: [n, ...state.notifications] }));
  },

  addConsultation: (input) => {
    const c: ConsultationRecord = { ...input, id: `cr${Date.now()}` };
    set((state) => ({ consultations: [c, ...state.consultations] }));
  },

  addAnnouncement: (input) => {
    const now = new Date().toISOString();
    const a: Announcement = {
      ...input,
      id: `an${Date.now()}`,
      createdAt: now,
      publishedAt: input.status === '게시됨' ? now : null,
      readCount: 0,
      totalCount: 0,
    };
    set((state) => ({ announcements: [a, ...state.announcements] }));
  },

  publishAnnouncement: (id) => {
    set((state) => ({
      announcements: state.announcements.map((a) =>
        a.id === id ? { ...a, status: '게시됨' as const, publishedAt: new Date().toISOString() } : a,
      ),
    }));
  },
}));
