/**
 * GET /api/ingang/completion/eligible?cursor=&limit=
 *
 * 이수증 발급 가능 패널 — 시리즈 완주했고 아직 Certificate 미발급인 (학생, 시리즈) pair.
 * cursor: LectureSeriesCompletion.id 기반.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const limit = Math.min(
    Number(searchParams.get('limit')) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  try {
    const rows = await prisma.lectureSeriesCompletion.findMany({
      where: {
        academyId,
        certificate: null, // Certificate 미발급만
      },
      orderBy: { completedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        completedAt: true,
        scoreSnapshot: true,
        studentId: true,
        student: { select: { name: true } },
        seriesId: true,
        series: { select: { title: true } },
      },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      seriesCompletionId: r.id,
      studentId: r.studentId,
      studentName: r.student.name,
      seriesId: r.seriesId,
      seriesTitle: r.series.title,
      completedAt: r.completedAt,
      scoreSnapshot: r.scoreSnapshot,
    }));

    const nextCursor = hasMore ? rows[rows.length - 1].id : null;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/ingang/completion/eligible]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
