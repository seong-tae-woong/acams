import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/reports/batches/[batchId]
// 발행 묶음에 포함된 학생별 리포트 목록 (열람 여부 포함)
export async function GET(req: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { batchId } = await ctx.params;

  try {
    const reports = await prisma.report.findMany({
      where: { academyId, batchId },
      select: {
        id: true,
        studentId: true,
        readAt: true,
        student: { select: { name: true } },
        class: { select: { name: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    if (reports.length === 0) {
      return NextResponse.json({ error: '발행 묶음을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      reports: reports.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.student.name,
        className: r.class?.name ?? null,
        readAt: r.readAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error('[GET /api/reports/batches/[batchId]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
