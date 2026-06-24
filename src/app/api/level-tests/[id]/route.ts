import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import {
  validateWrongNumbers,
  deriveSectionScores,
  computeScore100,
} from '@/lib/levelTest/scoring';
import type { LevelTestType, QuestionMapEntry } from '@/lib/levelTest/types';

type Ctx = { params: Promise<{ id: string }> };

// 레벨 테스트 Exam을 academy 범위에서 로드 (level test만)
async function loadLevelExam(id: string, academyId: string) {
  return prisma.exam.findFirst({
    where: { id, academyId, levelTestFormId: { not: null } },
    include: {
      gradeRecords: {
        select: { id: true, wrongNumbers: true, sectionScores: true, score: true, student: { select: { name: true, grade: true } } },
      },
    },
  });
}

// GET /api/level-tests/[id] — 채점 화면 데이터 (스냅샷 types/questionMap + 현재 채점 상태)
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const exam = await loadLevelExam(id, academyId);
    if (!exam) return NextResponse.json({ error: '레벨 테스트를 찾을 수 없습니다.' }, { status: 404 });
    const gr = exam.gradeRecords[0];

    return NextResponse.json({
      examId: exam.id,
      title: exam.name,
      subject: exam.subject,
      date: exam.date.toISOString().slice(0, 10),
      studentName: gr?.student.name ?? '',
      studentGrade: gr?.student.grade ?? null,
      types: (exam.types as unknown as LevelTestType[]) ?? [],
      questionMap: (exam.questionMap as unknown as QuestionMapEntry[]) ?? [],
      wrongNumbers: gr?.wrongNumbers ?? [],
      graded: gr?.sectionScores != null,
      score: gr?.score ?? null,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/level-tests/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/level-tests/[id] — 채점 제출 (틀린 번호 → 도출·캐시)
//   body: { wrongNumbers: number[] }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const exam = await loadLevelExam(id, academyId);
    if (!exam) return NextResponse.json({ error: '레벨 테스트를 찾을 수 없습니다.' }, { status: 404 });
    const gr = exam.gradeRecords[0];
    if (!gr) return NextResponse.json({ error: '채점 대상이 없습니다.' }, { status: 404 });

    const types = (exam.types as unknown as LevelTestType[]) ?? [];
    const questionMap = (exam.questionMap as unknown as QuestionMapEntry[]) ?? [];
    const total = questionMap.length;

    const body = await req.json();
    const wrongNumbers: number[] = Array.isArray(body.wrongNumbers)
      ? body.wrongNumbers.map((n: unknown) => Number(n))
      : [];

    const vw = validateWrongNumbers(wrongNumbers, total);
    if (!vw.ok) return NextResponse.json({ error: vw.errors[0] }, { status: 400 });

    // 스냅샷에서 도출 (단일 소스) → 캐시
    const sectionScores = deriveSectionScores(questionMap, types, wrongNumbers);
    const score = computeScore100(total, wrongNumbers.length);

    await prisma.gradeRecord.update({
      where: { id: gr.id },
      data: {
        wrongNumbers,
        sectionScores: sectionScores as unknown as object,
        score,
      },
    });

    return NextResponse.json({ score, sectionScores });
  } catch (err) {
    await logServerError(req, err);
    console.error('[PATCH /api/level-tests/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
