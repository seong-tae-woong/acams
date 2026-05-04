import type { Notification, ConsultationRecord, Announcement } from '@/lib/types/notification';

export const mockNotifications: Notification[] = [
  {
    id: 'n1', type: '출결알림', title: '결석 안내',
    content: '[세계로학원] 안녕하세요. 오늘 수업에 김도윤 학생이 결석하였습니다.',
    recipients: ['s1'], sentAt: '2026-04-17T16:30:00', sentBy: 'admin', readCount: 1, totalCount: 1, readRecipients: ['s1'],
  },
  {
    id: 'n2', type: '수납알림', title: '4월 수강료 청구 안내',
    content: '[세계로학원] 4월 수강료 280,000원이 청구되었습니다. 납부 기한: 4월 10일',
    recipients: ['s1', 's2', 's4', 's5', 's6', 's8', 's9', 's10', 's11', 's12', 's13', 's14', 's17', 's18', 's19', 's20'],
    sentAt: '2026-04-02T09:00:00', sentBy: 'admin', readCount: 14, totalCount: 16, readRecipients: [],
  },
  {
    id: 'n3', type: '일반', title: '4월 중간평가 성적 등록',
    content: '[세계로학원] 4월 중간평가 성적이 등록되었습니다. 앱에서 확인하세요.',
    recipients: ['s1', 's11', 's14', 's4', 's5', 's10'],
    sentAt: '2026-04-16T18:00:00', sentBy: 't2', readCount: 5, totalCount: 6, readRecipients: [],
  },
  {
    id: 'n4', type: '수납알림', title: '4월 수강료 미납 안내',
    content: '[세계로학원] 4월 수강료가 아직 납부되지 않았습니다. 빠른 납부 부탁드립니다.',
    recipients: ['s14', 's12', 's8', 's17', 's18'],
    sentAt: '2026-04-14T10:00:00', sentBy: 'admin', readCount: 3, totalCount: 5, readRecipients: [],
  },
  {
    id: 'n5', type: '공지', title: '4월 휴원 안내',
    content: '[세계로학원] 4월 30일(목)은 근로자의 날 대체 휴무로 수업이 없습니다.',
    recipients: ['s1', 's2', 's4', 's5', 's6', 's8', 's9', 's10', 's11', 's12', 's13', 's14', 's17', 's18', 's19', 's20'],
    sentAt: '2026-04-10T10:00:00', sentBy: 'admin', readCount: 15, totalCount: 16, readRecipients: [],
  },
];

export const mockConsultations: ConsultationRecord[] = [
  {
    id: 'cr1', studentId: 's1', studentName: '김도윤', parentName: '김부모',
    teacherId: 'admin', teacherName: '원장',
    date: '2026-04-08', time: '14:00', duration: 30, type: '대면',
    topic: '수학 성적 상담',
    content: '수학 성적 향상 추이 공유. 집중 시간이 짧아 보강 필요.',
    followUp: '다음 달 시험 후 재상담',
  },
  {
    id: 'cr2', studentId: 's5', studentName: '정민재', parentName: '정부모',
    teacherId: 't2', teacherName: '박선생',
    date: '2026-04-10', time: '11:00', duration: 20, type: '전화',
    topic: '복수 수강 피로도 확인',
    content: '영어+수학 동시 수강에 따른 피로도 확인. 학부모 동의 아래 현행 유지.',
    followUp: '5월 초 전화 상담',
  },
  {
    id: 'cr3', studentId: 's3', studentName: '박준서', parentName: '박부모',
    teacherId: 'admin', teacherName: '원장',
    date: '2026-04-05', time: '10:30', duration: 15, type: '전화',
    topic: '휴원 경과 확인',
    content: '휴원 경과 확인. 6월 복귀 의사 재확인.',
    followUp: '5월 말 연락',
  },
  {
    id: 'cr4', studentId: 's12', studentName: '배서연', parentName: '배부모',
    teacherId: 't2', teacherName: '박선생',
    date: '2026-04-12', time: '16:30', duration: 20, type: '대면',
    topic: '미납 처리 협의',
    content: '수납 미완료 건 확인. 가정 사정으로 다음 달 합산 납부 동의.',
    followUp: '5월 10일까지 납부 확인',
  },
  {
    id: 'cr5', studentId: 's2', studentName: '이수아', parentName: '이부모',
    teacherId: 't3', teacherName: '이선생',
    date: '2026-04-15', time: '17:00', duration: 20, type: '대면',
    topic: '반 이동 상담',
    content: '파닉스 진도 우수. 중급반 이동 제안.',
    followUp: '학부모 의사 확인 후 4월 말 반 이동 검토',
  },
  {
    id: 'cr6', studentId: 's9', studentName: '오승현', parentName: '오부모',
    teacherId: 't2', teacherName: '박선생',
    date: '2026-04-16', time: '18:00', duration: 30, type: '온라인',
    topic: '경시대회 참가 상담',
    content: '심화반 성적 상위권 유지. 경시대회 참가 권유.',
    followUp: '5월 경시대회 정보 제공',
  },
  {
    id: 'cr7', studentId: 's8', studentName: '한예린', parentName: '이부모',
    teacherId: 'admin', teacherName: '원장',
    date: '2026-04-17', time: '09:30', duration: 20, type: '전화',
    topic: '미납 2개월 안내',
    content: '미납 2개월 안내. 5월 5일까지 납부 약속.',
    followUp: '5월 5일 납부 확인',
  },
];

export const mockAnnouncements: Announcement[] = [
  {
    id: 'an1', title: '4월 휴원 안내 (근로자의날)',
    content: '안녕하세요, 세계로학원입니다.\n4월 30일(목)은 근로자의 날 대체 휴무로 모든 수업이 운영되지 않습니다.\n양해 부탁드립니다.',
    author: 'admin', targetAudience: ['all'],
    createdAt: '2026-04-10T09:00:00', publishedAt: '2026-04-10T09:30:00',
    status: '게시됨', pinned: true, readCount: 15, totalCount: 18, attachments: [],
  },
  {
    id: 'an2', title: '4월 학부모 상담 주간 안내',
    content: '4월 22일(수)~24일(금) 학부모 상담 주간을 운영합니다.\n담당 선생님을 통해 상담 시간을 예약해 주세요.',
    author: 'admin', targetAudience: ['all'],
    createdAt: '2026-04-08T10:00:00', publishedAt: '2026-04-08T10:00:00',
    status: '게시됨', pinned: false, readCount: 12, totalCount: 18, attachments: [],
  },
  {
    id: 'an3', title: '초등수학 기초반 교재 안내',
    content: '다음 달부터 새 교재를 사용합니다. 교재비 15,000원은 5월 청구서에 합산됩니다.',
    author: 't2', targetAudience: ['c1'],
    createdAt: '2026-04-15T14:00:00', publishedAt: '2026-04-15T14:00:00',
    status: '게시됨', pinned: false, readCount: 5, totalCount: 6, attachments: [],
  },
  {
    id: 'an4', title: '5월 시험 일정 안내 (초안)',
    content: '5월 시험 일정을 안내합니다. 자세한 내용은 추후 확정 후 재공지 예정입니다.',
    author: 'admin', targetAudience: ['all'],
    createdAt: '2026-04-17T09:00:00', publishedAt: null,
    status: '임시저장', pinned: false, readCount: 0, totalCount: 0, attachments: [],
  },
];
