import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { LectureStatus } from '@/generated/prisma/client';

// GET /api/lectures
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const lectures = await prisma.lecture.findMany({
      where: { academyId },
      include: { teacher: { select: { name: true } } },
      orderBy: [{ seriesId: 'asc' }, { episodeNumber: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(lectures);
  } catch (err) {
    console.error('[GET /api/lectures]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/lectures
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, teacherId, subjects, levels, targetGrades, cfVideoId, videoUrl, duration, orderIndex, status, seriesId, episodeNumber } = body;

    if (!title?.trim()) return NextResponse.json({ error: '강의명은 필수입니다.' }, { status: 400 });

    const lecture = await prisma.lecture.create({
      data: {
        academyId,
        title: title.trim(),
        description: description ?? '',
        teacherId: teacherId ?? null,
        subjects: subjects ?? [],
        levels: levels ?? [],
        targetGrades: targetGrades ?? [],
        cfVideoId: cfVideoId ?? null,
        videoUrl: videoUrl ?? null,
        duration: duration ?? '--:--',
        orderIndex: orderIndex ?? 0,
        status: (status as LectureStatus) ?? LectureStatus.DRAFT,
        seriesId: seriesId ?? null,
        episodeNumber: episodeNumber ?? null,
      },
      include: { teacher: { select: { name: true } } },
    });

    return NextResponse.json(lecture, { status: 201 });
  } catch (err) {
    console.error('[POST /api/lectures]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
