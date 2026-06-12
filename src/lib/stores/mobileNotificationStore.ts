'use client';
import { create } from 'zustand';

// 하단 탭 배지와 알림 페이지가 공유하는 미읽음 카운트.
// 알림을 읽으면 페이지가 즉시 스토어를 갱신 → 배지도 같은 프레임에 반영.
interface MobileNotificationStore {
  unread: number;
  setUnread: (n: number) => void;
  decrement: (n?: number) => void;
  fetchUnread: () => Promise<void>;
}

export const useMobileNotificationStore = create<MobileNotificationStore>((set) => ({
  unread: 0,
  setUnread: (n) => set({ unread: Math.max(0, n) }),
  decrement: (n = 1) => set((s) => ({ unread: Math.max(0, s.unread - n) })),
  fetchUnread: async () => {
    try {
      // studentId 미지정 → 학부모는 모든 자녀 합산, 학생은 본인 (서버가 역할로 분기)
      const r = await fetch('/api/mobile/notifications/unread-count');
      const d = await r.json();
      set({ unread: typeof d.count === 'number' ? d.count : 0 });
    } catch {
      set({ unread: 0 });
    }
  },
}));
