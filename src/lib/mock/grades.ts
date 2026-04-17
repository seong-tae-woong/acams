import type { Exam, GradeRecord } from '@/lib/types/grade';

export const mockExams: Exam[] = [
  {
    id: 'e1', name: '3월 월례테스트', subject: '수학',
    classId: 'c1', className: '초등수학 기초반',
    date: '2026-03-28', totalScore: 100, description: '3월 학습 내용 종합',
  },
  {
    id: 'e2', name: '4월 중간평가', subject: '수학',
    classId: 'c1', className: '초등수학 기초반',
    date: '2026-04-16', totalScore: 100, description: '4월 중간 평가',
  },
  {
    id: 'e3', name: '3월 월례테스트', subject: '수학',
    classId: 'c2', className: '초등수학 심화반',
    date: '2026-03-27', totalScore: 100, description: '3월 학습 내용 종합',
  },
  {
    id: 'e4', name: 'Phonics Quiz #3', subject: '영어',
    classId: 'c3', className: '영어 파닉스반',
    date: '2026-04-10', totalScore: 50, description: 'Unit 3~5 파닉스',
  },
  {
    id: 'e5', name: 'Mid-term Test', subject: '영어',
    classId: 'c4', className: '영어 중급반',
    date: '2026-04-14', totalScore: 100, description: '중간고사 대비',
  },
];

// c1 (초등수학 기초반) 학생들 성적
const c1Students = [
  { id: 's1', name: '김도윤' }, { id: 's11', name: '임도현' },
  { id: 's14', name: '유하준' }, { id: 's4', name: '최하은' },
  { id: 's5', name: '정민재' }, { id: 's10', name: '송지우' },
];

const e1Scores = [88, 72, 95, 65, 81, 77];
const e2Scores = [92, 75, 97, 68, 85, 79];

// c2 (초등수학 심화반) 학생들 성적
const c2Students = [
  { id: 's6', name: '강서윤' }, { id: 's9', name: '오승현' },
  { id: 's12', name: '배서연' }, { id: 's8', name: '한예린' },
];
const e3Scores = [90, 85, 78, 93];

// c3 (영어 파닉스반)
const c3Students = [
  { id: 's2', name: '이수아' }, { id: 's4', name: '최하은' },
  { id: 's8', name: '한예린' }, { id: 's10', name: '송지우' },
  { id: 's13', name: '권민서' }, { id: 's14', name: '유하준' },
  { id: 's19', name: '문서현' }, { id: 's5', name: '정민재' },
];
const e4Scores = [48, 42, 45, 38, 35, 44, 40, 47];

// c4 (영어 중급반)
const c4Students = [
  { id: 's5', name: '정민재' }, { id: 's8', name: '한예린' },
  { id: 's12', name: '배서연' }, { id: 's20', name: '양하윤' },
  { id: 's1', name: '김도윤' },
];
const e5Scores = [82, 78, 88, 75, 70];

function makeGrades(examId: string, students: { id: string; name: string }[], scores: number[]): GradeRecord[] {
  const sorted = [...scores].sort((a, b) => b - a);
  return students.map((s, i) => ({
    id: `gr-${examId}-${s.id}`,
    examId,
    studentId: s.id,
    studentName: s.name,
    score: scores[i],
    rank: sorted.indexOf(scores[i]) + 1,
    memo: '',
  }));
}

export const mockGrades: GradeRecord[] = [
  ...makeGrades('e1', c1Students, e1Scores),
  ...makeGrades('e2', c1Students, e2Scores),
  ...makeGrades('e3', c2Students, e3Scores),
  ...makeGrades('e4', c3Students, e4Scores),
  ...makeGrades('e5', c4Students, e5Scores),
];
