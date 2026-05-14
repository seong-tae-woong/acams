import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ReportTemplateKind } from '@/generated/prisma/client';
import { renderBody } from '@/lib/reports/tokens';
import { buildPeriodicData } from '@/lib/reports/buildPeriodic';
import { sendPushToStudents } from '@/lib/push/sendPush';

// POST /api/reports/publish-periodic
// body: { templateId, classIds?: string[], studentIds?: string[], summary?: string }
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { templateId, classIds, studentIds, summary, overrideBody, overrideTitle } = body as {
      templateId: string;
      classIds?: string[];
      studentIds?: string[];
      summary?: string;
      overrideBody?: string;
      overrideTitle?: string;
    };
    if (!templateId) return NextResponse.json({ error: 'templateId 필수' }, { status: 400 });

    const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, academyId } });
    if (!template) return NextResponse.json({ error: '양식 없음' }, { status: 404 });
    if (template.kind !== ReportTemplateKind.PERIODIC || !template.periodMonths) {
      return NextResponse.json({ error: '주기별 양식 + 집계 개월 수 설정 필요' }, { status: 400 });
    }

    // 대상 학생 수집
    const targetSet = new Set<string>(studentIds ?? []);
    if (classIds && classIds.length > 0) {
      const enrollments = await prisma.classEnrollment.findMany({
        where: { classId: { in: classIds }, isActive: true },
        select: { studentId: true },
      });
      enrollments.forEach((e) => targetSet.add(e.studentId));
    }
    const targets = Array.from(targetSet);
    if (targets.length === 0) {
      return NextResponse.json({ error: '대상 학생 없음' }, { status: 400 });
    }

    const scope = (template.scopeFilter as Record<string, string[]>) ?? {};

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const sourceBody = typeof overrideBody === 'string' && overrideBody.trim().length > 0
      ? overrideBody
      : template.bodyMarkdown;
    const finalTitle = overrideTitle?.trim() || template.name;
    const created: { studentId: string; reportId: string }[] = [];
    let periodLabel = '';

    for (const sid of targets) {
      const student = await prisma.student.findUnique({
        where: { id: sid },
        select: { name: true, grade: true, classEnrollments: { where: { isActive: true }, take: 1, include: { class: { select: { id: true, name: true } } } } },
      });
      if (!student) continue;

      const data = await buildPeriodicData(academyId, sid, template.periodMonths, scope);
      periodLabel = data.period.label;

      const renderedBody = renderBody(sourceBody, {
        학생: student.name,
        학년: student.grade,
        반: student.classEnrollments[0]?.class.name ?? '',
        기간: `${data.period.label} (${data.period.startLabel} ~ ${data.period.endLabel})`,
        대상카테고리: data.categoryLabels.length > 0 ? data.categoryLabels.join(', ') : '전체',
        기간평균: data.averageScore,
        기간최고: data.highestScore,
        기간최저: data.lowestScore,
        기간시험수: data.examCount,
        passThreshold: template.passThreshold,
      });

      const r = await prisma.report.create({
        data: {
          academyId,
          templateId,
          batchId,
          kind: ReportTemplateKind.PERIODIC,
          periodLabel: data.period.label,
          title: finalTitle,
          summary: summary?.trim() || (data.averageScore != null
            ? `평균 ${data.averageScore}점 · 시험 ${data.examCount}회`
            : '응시 시험 없음'),
          studentId: sid,
          classId: student.classEnrollments[0]?.class.id ?? null,
          examId: null,
          renderedBody,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: data as any,
          publishedBy: userId ?? null,
        },
      });
      created.push({ studentId: sid, reportId: r.id });
    }

    if (created.length > 0) {
      await sendPushToStudents(created.map((c) => c.studentId), {
        title: '새 정기 리포트가 도착했습니다',
        body: `${periodLabel} 리포트를 확인하세요.`,
        url: '/mobile/reports',
        tag: `report-periodic-${periodLabel}`,
      });
    }

    return NextResponse.json({ ok: true, count: created.length, periodLabel, reports: created });
  } catch (err) {
    console.error('[POST /api/reports/publish-periodic]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
