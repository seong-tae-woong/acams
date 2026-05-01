import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { LectureStatus } from '@/generated/prisma/client';

// GET /api/lecture-series
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    console.error('[GET /api/lecture-series]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/lecture-series
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    console.error('[POST /api/lecture-series]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
