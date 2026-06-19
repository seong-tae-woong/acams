import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { sendPushToStudents } from '@/lib/push/sendPush';
import {
  buildLevelTestReportData,
  computeCohortAverages,
  warnIfCohortLarge,
  LEVELTEST_COHORT_THRESHOLD,
} from '@/lib/levelTest/report';
import type { SectionScore } from '@/lib/levelTest/types';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/level-tests/[id]/report — 채점된 레벨 테스트 리포트 발행 (+학부모 푸시)
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role, userId } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const exam = await prisma.exam.findFirst({
      where: { id, academyId, levelTestFormId: { not: null } },
      include: {
        gradeRecords: {
          select: {
            score: true,
            sectionScores: true,
            studentId: true,
            student: { select: { name: true, grade: true } },
          },
        },
      },
    });
    if (!exam) return NextResponse.json({ error: '레벨 테스트를 찾을 수 없습니다.' }, { status: 404 });

    const gr = exam.gradeRecords[0];
    if (!gr || gr.score == null || gr.sectionScores == null) {
      return NextResponse.json({ error: '먼저 채점을 완료하세요.' }, { status: 400 });
    }
    const formId = exam.levelTestFormId!;
    const sectionScores = gr.sectionScores as unknown as SectionScore[];

    // 양식 표시 토글
    const form = await prisma.levelTestForm.findUnique({ where: { id: formId }, select: { showAverage: true } });
    const showAverage = form?.showAverage ?? true;

    // 5A 즉석 집계: 같은 양식의 채점 완료 응시자
    const cohort = await prisma.gradeRecord.findMany({
      where: { academyId, score: { not: null }, exam: { levelTestFormId: formId } },
      select: { sectionScores: true },
    });
    const N = cohort.length;
    warnIfCohortLarge(N, formId);
    const useCohort = N >= LEVELTEST_COHORT_THRESHOLD;
    const cohortAverages = useCohort
      ? computeCohortAverages(
          cohort
            .map((r) => (r.sectionScores as unknown as SectionScore[]) ?? [])
            .filter((a) => a.length > 0),
        )
      : null;

    const data = buildLevelTestReportData({
      studentName: gr.student.name,
      studentGrade: gr.student.grade,
      subject: exam.subject,
      date: exam.date.toISOString().slice(0, 10),
      totalScore: gr.score,
      sectionScores,
      showAverage,
      useCohort,
      cohortAverages,
    });

    const title = `${exam.name} 결과`;
    const summary = `종합 ${data.totalScore}점`;

    // 재발행 시 기존 리포트 갱신 (레벨 테스트당 1개)
    const existing = await prisma.report.findFirst({
      where: { academyId, examId: exam.id, studentId: gr.studentId, kind: 'LEVEL_TEST' },
      select: { id: true },
    });

    let reportId: string;
    if (existing) {
      await prisma.report.update({
        where: { id: existing.id },
        data: {
          title,
          summary,
          data: data as unknown as object,
          publishedAt: new Date(),
          publishedBy: userId,
          readAt: null,
        },
      });
      reportId = existing.id;
    } else {
      const report = await prisma.report.create({
        data: {
          academyId,
          kind: 'LEVEL_TEST',
          studentId: gr.studentId,
          examId: exam.id,
          classId: null,
          templateId: null,
          title,
          summary,
          periodLabel: '',
          renderedBody: '',
          data: data as unknown as object,
          layout: [],
          publishedBy: userId,
        },
        select: { id: true },
      });
      reportId = report.id;
    }

    void sendPushToStudents([gr.studentId], {
      title: '레벨 테스트 결과가 나왔어요',
      body: `${exam.name} · 종합 ${data.totalScore}점`,
      url: `/mobile/reports/${reportId}`,
      tag: `lvtest-${reportId}`,
    });

    return NextResponse.json({ reportId });
  } catch (err) {
    console.error('[POST /api/level-tests/[id]/report]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
