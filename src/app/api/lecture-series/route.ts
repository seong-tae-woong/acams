import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { LectureStatus } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/lecture-series
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const series = await prisma.lectureSeries.findMany({
      where: { academyId },
      include: {
        _count: { select: { lectures: true } },
      },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json(series);
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/lecture-series]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/lecture-series
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, description, orderIndex, status } = body;

    if (!title?.trim()) return NextResponse.json({ error: '시리즈명은 필수입니다.' }, { status: 400 });

    const series = await prisma.lectureSeries.create({
      data: {
        academyId,
        title: title.trim(),
        description: description ?? '',
        orderIndex: orderIndex ?? 0,
        status: (status as LectureStatus) ?? LectureStatus.DRAFT,
      },
      include: {
        _count: { select: { lectures: true } },
      },
    });

    return NextResponse.json(series, { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/lecture-series]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
