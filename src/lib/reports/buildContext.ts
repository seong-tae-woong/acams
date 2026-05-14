// 시험 + 학생 → TokenContext 빌드
// PER_EXAM 발행 시 사용

import { prisma } from '@/lib/db/prisma';
import type { TokenContext } from './tokens';

export interface PerExamContextResult {
  context: TokenContext;
  // 표 렌더링용 raw
  raw: {
    studentId: string;
    studentName: string;
    score: number | null;
    rank: number | null;
    totalScore: number;
    classAverage: number | null;
    classHighest: number | null;
    classCount: number;
    examName: string;
    examDate: string;
    className: string;
  };
}

// 한 번에 여러 학생의 컨텍스트를 만든다 (반 평균/순위 계산을 1번만 하기 위함)
export async function buildPerExamContexts(
  examId: string,
  studentIds: string[],
  passThreshold: number,
): Promise<Map<string, PerExamContextResult>> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      class: { select: { id: true, name: true } },
      gradeRecords: {
        select: { studentId: true, score: true, rank: true },
      },
    },
  });
  if (!exam) return new Map();

  // 반 통계
  const scoredAll = exam.gradeRecords.filter((g) => g.score !== null);
  const allScores = scoredAll.map((g) => g.score as number);
  const classCount = exam.gradeRecords.length;
  const classAverage = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : null;
  const classHighest = allScores.length > 0 ? Math.max(...allScores) : null;

  // 학생 데이터 + 직전 시험 점수 매핑
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, name: true, grade: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // 직전 시험 점수 — 각 학생의 같은 반 + examDate 이전의 가장 최근 시험 점수
  const prevGradesByStudent = new Map<string, number | null>();
  for (const sid of studentIds) {
    const prev = await prisma.gradeRecord.findFirst({
      where: {
        studentId: sid,
        score: { not: null },
        exam: { classId: exam.classId, date: { lt: exam.date } },
      },
      orderBy: { exam: { date: 'desc' } },
      select: { score: true },
    });
    prevGradesByStudent.set(sid, prev?.score ?? null);
  }

  const result = new Map<string, PerExamContextResult>();
  const dateStr = exam.date.toISOString().slice(0, 10);

  for (const sid of studentIds) {
    const stu = studentMap.get(sid);
    if (!stu) continue;
    const my = exam.gradeRecords.find((g) => g.studentId === sid);
    const score = my?.score ?? null;
    const rank = my?.rank ?? null;
    const pct = score != null ? Math.round((score / exam.totalScore) * 100) : null;
    const diff = score != null && classAverage != null
      ? Math.round((score - classAverage) * 10) / 10
      : null;

    result.set(sid, {
      context: {
        학생: stu.name,
        학년: stu.grade,
        반: exam.class.name,
        시험명: exam.name,
        시험일: dateStr,
        만점: exam.totalScore,
        점수: score,
        백분율: pct,
        순위: rank,
        반인원: classCount,
        반평균: classAverage != null ? Math.round(classAverage * 10) / 10 : null,
        반최고: classHighest,
        평균차이: diff,
        직전점수: prevGradesByStudent.get(sid) ?? null,
        passThreshold,
      },
      raw: {
        studentId: sid,
        studentName: stu.name,
        score,
        rank,
        totalScore: exam.totalScore,
        classAverage: classAverage != null ? Math.round(classAverage * 10) / 10 : null,
        classHighest,
        classCount,
        examName: exam.name,
        examDate: dateStr,
        className: exam.class.name,
      },
    });
  }

  return result;
}
