/**
 * GET /api/ingang-tablet/lectures?sessionId=&classId=
 *
 * 승인된 세션의 classId 기준으로 강의 목록 + cfVideoId 반환.
 * role=tablet 전용. cfVideoId는 인강 재생에 필요하므로 여기서만 내려줌.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  const academyId = req.headers.get('x-academy-id');

  if (role !== 'tablet' || !academyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const classId = searchParams.get('classId');

  if (!sessionId || !classId) {
    return NextResponse.json({ error: 'sessionId와 classId가 필요합니다.' }, { status: 400 });
  }

  try {
    // 세션 유효성 확인
    const session = await prisma.ingangViewSession.findFirst({
      where: { id: sessionId, academyId, status: 'APPROVED' },
    });
    if (!session) {
      return NextResponse.json({ error: '유효하지 않은 세션입니다.' }, { status: 403 });
    }

    // 해당 반에 배정된 PUBLISHED 강의 목록 (cfVideoId 포함)
    const targets = await prisma.lectureTarget.findMany({
      where: { classId },
      include: {
        lecture: {
          select: {
            id: true,
            title: true,
            description: true,
            duration: true,
            cfVideoId: true,
            videoUrl: true,
            seriesId: true,
            episodeNumber: true,
            orderIndex: true,
            status: true,
            teacher: { select: { name: true } },
            studentNotes: {
              where: { studentId: session.studentId },
              select: { note: true },
            },
          },
        },
      },
    });

    const lectures = targets
      .filter((t) => t.lecture.status === 'PUBLISHED')
      .sort((a, b) => {
        if (a.lecture.seriesId !== b.lecture.seriesId)
          return (a.lecture.seriesId ?? '').localeCompare(b.lecture.seriesId ?? '');
        if ((a.lecture.episodeNumber ?? 0) !== (b.lecture.episodeNumber ?? 0))
          return (a.lecture.episodeNumber ?? 0) - (b.lecture.episodeNumber ?? 0);
        return a.lecture.orderIndex - b.lecture.orderIndex;
      })
      .map((t) => ({
        lectureId: t.lecture.id,
        title: t.lecture.title,
        description: t.lecture.description,
        duration: t.lecture.duration,
        cfVideoId: t.lecture.cfVideoId,
        videoUrl: t.lecture.videoUrl,
        teacherName: t.lecture.teacher?.name ?? null,
        note: t.lecture.studentNotes[0]?.note ?? null,
      }));

    return NextResponse.json({ lectures });
  } catch (err) {
    console.error('[GET /api/ingang-tablet/lectures]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
