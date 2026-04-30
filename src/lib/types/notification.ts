// 알림/상담/공지 관련 타입 정의

export type NotificationType = '공지' | '출결알림' | '수납알림' | '상담알림' | '일반';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  recipients: string[]; // 수신자 ID 배열 (학생 또는 학부모)
  sentAt: string; // ISO datetime string
  sentBy: string; // 발신자 ID (강사/관리자)
  readCount: number;
  totalCount: number;
  billIds?: string[]; // 수납알림 시 연결된 청구서 ID 목록
}

export type ConsultationType = '대면' | '전화' | '온라인';

export interface ConsultationRecord {
  id: string;
  studentId: string;
  studentName: string;
  parentName: string;
  teacherId: string;
  teacherName: string;
  date: string; // ISO date string (YYYY-MM-DD)
  time: string; // "HH:MM"
  duration: number; // 분 단위
  type: ConsultationType;
  topic: string;
  content: string; // 상담 내용
  followUp: string; // 후속 조치
}

export type AnnouncementStatus = '임시저장' | '게시됨';

export interface AnnouncementAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number; // bytes
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string; // 작성자 ID
  targetAudience: string[]; // 대상 (반 ID 배열 또는 ['all'])
  createdAt: string; // ISO datetime string
  publishedAt: string | null; // 게시일 (임시저장 시 null)
  status: AnnouncementStatus;
  pinned: boolean;
  readCount: number;
  totalCount: number;
  attachments: AnnouncementAttachment[];
  classId?: string | null;   // 반 지정 (null = 전체)
  className?: string | null; // 반 이름 (읽기용)
}

export type NotificationCreateInput = Omit<Notification, 'id' | 'sentAt' | 'readCount' | 'totalCount'>;

export type ConsultationCreateInput = Omit<ConsultationRecord, 'id'>;

export type AnnouncementCreateInput = Omit<Announcement, 'id' | 'createdAt' | 'publishedAt' | 'readCount' | 'totalCount'>;

// ── 공개 페이지 상담 신청 ──────────────────────────
export type InquiryStatus = 'NEW' | 'READ' | 'REPLIED';

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW:     '신규',
  READ:    '확인',
  REPLIED: '답변완료',
};

export const INQUIRY_STATUS_STYLE: Record<InquiryStatus, { bg: string; text: string }> = {
  NEW:     { bg: '#FEE2E2', text: '#991B1B' },
  READ:    { bg: '#DBEAFE', text: '#1E40AF' },
  REPLIED: { bg: '#D1FAE5', text: '#065F46' },
};

export interface PublicInquiry {
  id:        string;
  name:      string;   // 학생 이름
  phone:     string;   // 연락처
  classId:   string | null;
  className: string | null;
  message:   string;
  status:    InquiryStatus;
  memo:      string;
  createdAt: string;   // ISO datetime
}

export interface NotificationTemplate {
  id: string;
  category: NotificationType;
  title: string;
  content: string;
  createdAt: string;
}

export interface NotificationFilter {
  type?: NotificationType;
  sentBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ConsultationFilter {
  studentId?: string;
  teacherId?: string;
  type?: ConsultationType;
  dateFrom?: string;
  dateTo?: string;
}
