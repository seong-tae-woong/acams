import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';

// GET /api/mobile/reports/[id]?studentId=
// 상세 + 첫 열람 시 readAt 마킹
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');
  if (!academyId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'student' && role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const requestedStudentId = new URL(req.url).searchParams.get('studentId');

  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) return NextResponse.json({ error: '학생 정보 없음' }, { status: 404 });

    const report = await prisma.report.findFirst({
      where: { id, academyId, studentId },
      include: {
        template: { select: { name: true, layout: true } },
        student: { select: { name: true } },
        class: { select: { name: true } },
        exam: { select: { name: true, date: true, totalScore: true } },
      },
    });
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!report.readAt) {
      await prisma.report.update({ where: { id }, data: { readAt: new Date() } }).catch(() => {});
    }

    return NextResponse.json({
      id: report.id,
      kind: report.kind,
      title: report.title,
      summary: report.summary,
      periodLabel: report.periodLabel,
      publishedAt: report.publishedAt.toISOString(),
      renderedBody: report.renderedBody,
      data: report.data,
      layout: report.template.layout,
      studentName: report.student.name,
      className: report.class?.name ?? null,
      exam: report.exam ? {
        name: report.exam.name,
        date: report.exam.date.toISOString().slice(0, 10),
        totalScore: report.exam.totalScore,
      } : null,
    });
  } catch (err) {
    console.error('[GET /api/mobile/reports/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
