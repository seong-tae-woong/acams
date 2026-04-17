import type { CalendarEvent, MakeupClass } from '@/lib/types/calendar';

export const mockCalendarEvents: CalendarEvent[] = [
  // 학원 일정 (공개)
  { id: 'ce1', title: '학부모 상담 기간', date: '2026-04-22', startTime: '14:00', endTime: '18:00', type: '학원일정', isPublic: true, description: '4월 학부모 상담 기간 운영 (22일~24일)', color: '#4fc3a1', relatedStudentId: null },
  { id: 'ce2', title: '학부모 상담 기간', date: '2026-04-23', startTime: '14:00', endTime: '18:00', type: '학원일정', isPublic: true, description: '4월 학부모 상담 기간 운영 (22일~24일)', color: '#4fc3a1', relatedStudentId: null },
  { id: 'ce3', title: '학부모 상담 기간', date: '2026-04-24', startTime: '14:00', endTime: '18:00', type: '학원일정', isPublic: true, description: '4월 학부모 상담 기간 운영 (22일~24일)', color: '#4fc3a1', relatedStudentId: null },
  { id: 'ce4', title: '휴원 (근로자의 날 대체)', date: '2026-04-30', startTime: null, endTime: null, type: '학원일정', isPublic: true, description: '전 수업 휴강', color: '#ef4444', relatedStudentId: null },
  { id: 'ce5', title: '4월 중간평가', date: '2026-04-16', startTime: '16:00', endTime: '17:00', type: '학원일정', isPublic: true, description: '초등수학 기초반/심화반 중간평가', color: '#f59e0b', relatedStudentId: null },
  // 상담 일정 (비공개)
  { id: 'ce6', title: '김도윤 학부모 상담', date: '2026-04-22', startTime: '14:00', endTime: '14:30', type: '상담일정', isPublic: false, description: '수학 성적 및 학습 방향 상담', color: '#6366f1', relatedStudentId: 's1' },
  { id: 'ce7', title: '이수아 학부모 상담', date: '2026-04-22', startTime: '15:00', endTime: '15:30', type: '상담일정', isPublic: false, description: '영어 파닉스 진도 및 중급반 이동 상담', color: '#6366f1', relatedStudentId: 's2' },
  { id: 'ce8', title: '정민재 학부모 상담', date: '2026-04-23', startTime: '14:00', endTime: '14:30', type: '상담일정', isPublic: false, description: '수학+영어 동시 수강 피로도 확인', color: '#6366f1', relatedStudentId: 's5' },
  { id: 'ce9', title: '최하은 학부모 상담', date: '2026-04-23', startTime: '15:30', endTime: '16:00', type: '상담일정', isPublic: false, description: '출결 및 성적 전반 상담', color: '#6366f1', relatedStudentId: 's4' },
  { id: 'ce10', title: '배서연 학부모 상담', date: '2026-04-24', startTime: '14:30', endTime: '15:00', type: '상담일정', isPublic: false, description: '미납 건 및 학습 태도 상담', color: '#6366f1', relatedStudentId: 's12' },
  // 보강 일정
  { id: 'ce11', title: '보강 — 초등수학 기초반', date: '2026-04-19', startTime: '14:00', endTime: '15:00', type: '보강일정', isPublic: true, description: '4/8 결석분 보강', color: '#8b5cf6', relatedStudentId: null },
  { id: 'ce12', title: '보강 — 영어 파닉스반', date: '2026-04-18', startTime: '15:00', endTime: '16:00', type: '보강일정', isPublic: true, description: '4/10 결석분 보강', color: '#8b5cf6', relatedStudentId: null },
];

export const mockMakeupClasses: MakeupClass[] = [
  {
    id: 'mc1',
    originalClassId: 'c1', originalClassName: '초등수학 기초반',
    originalDate: '2026-04-08',
    makeupDate: '2026-04-19', makeupTime: '14:00',
    teacherId: 't2', teacherName: '박선생',
    targetStudents: ['s3', 's11'],
    reason: '결석',
    attendanceChecked: false,
  },
  {
    id: 'mc2',
    originalClassId: 'c3', originalClassName: '영어 파닉스반',
    originalDate: '2026-04-10',
    makeupDate: '2026-04-18', makeupTime: '15:00',
    teacherId: 't3', teacherName: '이선생',
    targetStudents: ['s8'],
    reason: '결석',
    attendanceChecked: true,
  },
];
