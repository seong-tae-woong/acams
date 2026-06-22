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

function isStaff(role: string) {
  return role === 'director' || role === 'teacher' || role === 'super_admin';
}

// 채점 완료된 레벨 테스트 Exam 로드 (학원 범위, level test만)
async function loadGradedExam(id: string, academyId: string) {
  return prisma.exam.findFirst({
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
}

type GradedExam = NonNullable<Awaited<ReturnType<typeof loadGradedExam>>>;
type GradeRec = GradedExam['gradeRecords'][number];

type ReportOpts = { comment?: string; classId?: string; className?: string; narrative?: string };

// 리포트 데이터 조립 (미리보기·발행 공용 단일 소스). opts는 발행/원장 판정 시에만 전달.
// 반은 원장이 모달에서 직접 선택 → opts.className/classId로 전달(배치). 반 목록은 GET /api/classes.
async function buildReportPayload(exam: GradedExam, gr: GradeRec, academyId: string, opts: ReportOpts = {}) {
  const formId = exam.levelTestFormId!;
  const sectionScores = gr.sectionScores as unknown as SectionScore[];

  const form = await prisma.levelTestForm.findUnique({ where: { id: formId }, select: { showAverage: true } });
  const showAverage = form?.showAverage ?? true;

  // 5A 즉석 집계: 같은 양식의 채점 완료 응시자 평균
  const cohort = await prisma.gradeRecord.findMany({
    where: { academyId, score: { not: null }, exam: { levelTestFormId: formId } },
    select: { sectionScores: true, score: true },
  });
  const N = cohort.length;
  warnIfCohortLarge(N, formId);
  const useCohort = N >= LEVELTEST_COHORT_THRESHOLD;
  const cohortSectionsList = cohort
    .map((r) => (r.sectionScores as unknown as SectionScore[]) ?? [])
    .filter((a) => a.length > 0);
  const cohortAverages = useCohort ? computeCohortAverages(cohortSectionsList) : null;

  return buildLevelTestReportData({
    studentName: gr.student.name,
    studentGrade: gr.student.grade,
    subject: exam.subject,
    date: exam.date.toISOString().slice(0, 10),
    totalScore: gr.score!,
    sectionScores,
    showAverage,
    useCohort,
    cohortAverages,
    comment: opts.comment,
    className: opts.className,
    classId: opts.classId,
    narrativeOverride: opts.narrative,
    cohortTotals: cohort.map((r) => r.score!).filter((s): s is number => s != null),
    cohortSections: cohortSectionsList,
  });
}

// GET /api/level-tests/[id]/report — 리포트 미리보기 (발행 전, 저장 없음)
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (!isStaff(role)) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  const { id } = await ctx.params;

  try {
    const exam = await loadGradedExam(id, academyId);
    if (!exam) return NextResponse.json({ error: '레벨 테스트를 찾을 수 없습니다.' }, { status: 404 });
    const gr = exam.gradeRecords[0];
    if (!gr || gr.score == null || gr.sectionScores == null) {
      return NextResponse.json({ error: '먼저 채점을 완료하세요.' }, { status: 400 });
    }
    const data = await buildReportPayload(exam, gr, academyId);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET /api/level-tests/[id]/report]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/level-tests/[id]/report — 리포트 발행 (+학부모 푸시). body: { comment?: string }
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role, userId } = auth;
  if (!isStaff(role)) return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  const { id } = await ctx.params;

  try {
    const exam = await loadGradedExam(id, academyId);
    if (!exam) return NextResponse.json({ error: '레벨 테스트를 찾을 수 없습니다.' }, { status: 404 });
    const gr = exam.gradeRecords[0];
    if (!gr || gr.score == null || gr.sectionScores == null) {
      return NextResponse.json({ error: '먼저 채점을 완료하세요.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const opts = {
      comment: typeof body.comment === 'string' ? body.comment : undefined,
      classId: typeof body.classId === 'string' ? body.classId : undefined,
      className: typeof body.className === 'string' ? body.className : undefined,
      narrative: typeof body.narrative === 'string' ? body.narrative : undefined,
    };

    const data = await buildReportPayload(exam, gr, academyId, opts);
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
