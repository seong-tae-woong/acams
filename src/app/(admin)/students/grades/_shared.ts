// 성적 관리 — 공용 상수·타입

export type MainTab = 'exam' | 'assignment' | 'publish' | 'report-templates';

export const TAB_OPTIONS = [
  { value: 'exam', label: '시험 목록' },
  { value: 'assignment', label: '과제' },
  { value: 'publish', label: '리포트 발행' },
  { value: 'report-templates', label: '리포트 양식' },
];

export interface Assignment {
  id: string;
  classId: string;
  className: string;
  classSubject: string;
  date: string;
  dueDate: string;
  memo: string;
}

export interface AssignmentForm {
  date: string;
  dueDate: string;
  memo: string;
}

export const EMPTY_ASSIGNMENT_FORM: AssignmentForm = {
  date: new Date().toISOString().slice(0, 10),
  dueDate: '',
  memo: '',
};

export interface ExamForm {
  name: string;
  date: string;
  totalScore: string;
  description: string;
  category1Id: string;
  category2Id: string;
  category3Id: string;
}

export const EMPTY_EXAM_FORM: ExamForm = {
  name: '',
  date: new Date().toISOString().slice(0, 10),
  totalScore: '100',
  description: '',
  category1Id: '',
  category2Id: '',
  category3Id: '',
};

// 탭 진입 시 등록일 기준 최근 N개만 로딩, 스크롤 시 N개씩 추가
export const PAGE_SIZE = 10;

export const fieldClass = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';
