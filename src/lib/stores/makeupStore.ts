'use client';
import { create } from 'zustand';
import { mockMakeupClasses } from '@/lib/mock/calendar';
import type { MakeupClass } from '@/lib/types/calendar';

interface MakeupStore {
  makeupClasses: MakeupClass[];
  addMakeupClass: (input: Omit<MakeupClass, 'id' | 'attendanceChecked' | 'targetStudents'>) => string;
  updateMakeupClass: (id: string, updates: Partial<Omit<MakeupClass, 'id'>>) => void;
  removeMakeupClass: (id: string) => void;
  addStudents: (makeupClassId: string, studentIds: string[]) => void;
  removeStudent: (makeupClassId: string, studentId: string) => void;
  setAttendanceChecked: (makeupClassId: string, checked: boolean) => void;
}

export const useMakeupStore = create<MakeupStore>((set) => ({
  makeupClasses: mockMakeupClasses.map((mc) => ({ ...mc })),

  addMakeupClass: (input) => {
    const id = `mc${Date.now()}`;
    const newMakeup: MakeupClass = {
      ...input,
      id,
      targetStudents: [],
      attendanceChecked: false,
    };
    set((state) => ({ makeupClasses: [...state.makeupClasses, newMakeup] }));
    return id;
  },

  updateMakeupClass: (id, updates) => {
    set((state) => ({
      makeupClasses: state.makeupClasses.map((mc) =>
        mc.id === id ? { ...mc, ...updates } : mc,
      ),
    }));
  },

  removeMakeupClass: (id) => {
    set((state) => ({
      makeupClasses: state.makeupClasses.filter((mc) => mc.id !== id),
    }));
  },

  addStudents: (makeupClassId, studentIds) => {
    set((state) => ({
      makeupClasses: state.makeupClasses.map((mc) => {
        if (mc.id !== makeupClassId) return mc;
        const merged = Array.from(new Set([...mc.targetStudents, ...studentIds]));
        return { ...mc, targetStudents: merged };
      }),
    }));
  },

  removeStudent: (makeupClassId, studentId) => {
    set((state) => ({
      makeupClasses: state.makeupClasses.map((mc) => {
        if (mc.id !== makeupClassId) return mc;
        return { ...mc, targetStudents: mc.targetStudents.filter((id) => id !== studentId) };
      }),
    }));
  },

  setAttendanceChecked: (makeupClassId, checked) => {
    set((state) => ({
      makeupClasses: state.makeupClasses.map((mc) =>
        mc.id === makeupClassId ? { ...mc, attendanceChecked: checked } : mc,
      ),
    }));
  },
}));
