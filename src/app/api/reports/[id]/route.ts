import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/reports/[id]
// 원장/강사용 발행된 리포트 상세 (열람 시각 마킹 없음)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const report = await prisma.report.findFirst({
      where: { id, academyId },
      include: {
        template: { select: { name: true, layout: true } },
        student: { select: { name: true } },
        class: { select: { name: true } },
        exam: { select: { name: true, date: true, totalScore: true } },
      },
    });
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 발행 시점 layout 스냅샷 우선, 없으면(구 데이터) 양식 layout으로 폴백
    const layout = Array.isArray(report.layout) && report.layout.length > 0
      ? report.layout
      : report.template.layout;

    return NextResponse.json({
      id: report.id,
      kind: report.kind,
      title: report.title,
      summary: report.summary,
      periodLabel: report.periodLabel,
      publishedAt: report.publishedAt.toISOString(),
      readAt: report.readAt?.toISOString() ?? null,
      renderedBody: report.renderedBody,
      data: report.data,
      layout,
      studentName: report.student.name,
      className: report.class?.name ?? null,
      exam: report.exam ? {
        name: report.exam.name,
        date: report.exam.date.toISOString().slice(0, 10),
        totalScore: report.exam.totalScore,
      } : null,
    });
  } catch (err) {
    console.error('[GET /api/reports/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
