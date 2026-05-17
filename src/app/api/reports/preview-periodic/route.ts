import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ReportTemplateKind } from '@/generated/prisma/client';
import { renderBody } from '@/lib/reports/tokens';
import { buildPeriodicData } from '@/lib/reports/buildPeriodic';
import { requireAuth } from '@/lib/auth/requireAuth';

// POST /api/reports/preview-periodic
// body: { templateId, studentId }
// → { renderedBody, layout, data }
//   - DB write 없이 발행 시점 기준 데이터를 미리 계산
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const { templateId, studentId, bodyMarkdown } = await req.json();
    if (!templateId || !studentId) {
      return NextResponse.json({ error: 'templateId, studentId 필수' }, { status: 400 });
    }

    const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, academyId } });
    if (!template) return NextResponse.json({ error: '양식 없음' }, { status: 404 });
    if (template.kind !== ReportTemplateKind.PERIODIC || !template.periodMonths) {
      return NextResponse.json({ error: '주기별 양식 + 집계 개월 수 필요' }, { status: 400 });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, academyId },
      select: {
        name: true, grade: true,
        classEnrollments: {
          where: { isActive: true }, take: 1,
          include: { class: { select: { name: true } } },
        },
      },
    });
    if (!student) return NextResponse.json({ error: '학생 정보 없음' }, { status: 404 });

    const scope = (template.scopeFilter as Record<string, string[]>) ?? {};
    const data = await buildPeriodicData(academyId, studentId, template.periodMonths, scope);

    const sourceBody = typeof bodyMarkdown === 'string' ? bodyMarkdown : template.bodyMarkdown;
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

    return NextResponse.json({
      renderedBody,
      layout: template.layout,
      data,
      studentName: student.name,
    });
  } catch (err) {
    console.error('[POST /api/reports/preview-periodic]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
