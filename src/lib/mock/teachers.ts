import type { Teacher } from '@/lib/types/teacher';
import { DEFAULT_PERMISSIONS } from '@/lib/types/teacher';

export const mockTeachers: Teacher[] = [
  {
    id: 't1',
    name: '김선생',
    subject: '수학',
    phone: '010-9876-5432',
    email: 'kim@acams.kr',
    classes: ['c5'],
    permissions: { ...DEFAULT_PERMISSIONS, manageStudents: true },
    isActive: true,
    avatarColor: '#ef4444',
  },
  {
    id: 't2',
    name: '박선생',
    subject: '수학',
    phone: '010-8765-4321',
    email: 'park@acams.kr',
    classes: ['c1', 'c2'],
    permissions: { ...DEFAULT_PERMISSIONS, manageStudents: true },
    isActive: true,
    avatarColor: '#4fc3a1',
  },
  {
    id: 't3',
    name: '이선생',
    subject: '영어',
    phone: '010-7654-3210',
    email: 'lee@acams.kr',
    classes: ['c3', 'c4'],
    permissions: { ...DEFAULT_PERMISSIONS },
    isActive: true,
    avatarColor: '#f59e0b',
  },
];
