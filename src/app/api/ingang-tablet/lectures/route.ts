/**
 * GET /api/ingang-tablet/lectures?sessionId=&classId=
 *
 * 승인된 세션 기준으로 강의 목록 + cfVideoId 반환.
 * classId가 실제 반이면 해당 반의 CLASS 모드 강의를,
 * classId가 가상 분류('__direct__')면 전체 공개·개별 지정 강의를 반환.
 * role=tablet 전용. cfVideoId는 인강 재생에 필요하므로 여기서만 내려줌.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// 반에 속하지 않는 강의(전체 공개·개별 지정)를 묶는 가상 분류 ID
const DIRECT_CLASS_ID = '__direct__';

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

    type LectureRow = {
      id: string;
      title: string;
      description: string;
      duration: string;
      cfVideoId: string | null;
      videoUrl: string | null;
      seriesId: string | null;
      episodeNumber: number | null;
      orderIndex: number;
      status: string;
      teacher: { name: string } | null;
      studentNotes: { note: string }[];
    };

    let lectureList: LectureRow[];

    if (classId === DIRECT_CLASS_ID) {
      // 전체 공개(ALL) + 개별 지정(INDIVIDUAL) 강의
      lectureList = await prisma.lecture.findMany({
        where: {
          academyId,
          OR: [
            { targetMode: 'ALL' },
            { targetMode: 'INDIVIDUAL', studentTargets: { some: { studentId: session.studentId } } },
          ],
        },
        select: {
          id: true, title: true, description: true, duration: true,
          cfVideoId: true, videoUrl: true, seriesId: true,
          episodeNumber: true, orderIndex: true, status: true,
          teacher: { select: { name: true } },
          studentNotes: { where: { studentId: session.studentId }, select: { note: true } },
        },
      });
    } else {
      // 해당 반에 배정된 CLASS 모드 강의 (다른 모드로 전환된 강의는 제외)
      const targets = await prisma.lectureTarget.findMany({
        where: { classId, lecture: { targetMode: 'CLASS' } },
        include: {
          lecture: {
            select: {
              id: true, title: true, description: true, duration: true,
              cfVideoId: true, videoUrl: true, seriesId: true,
              episodeNumber: true, orderIndex: true, status: true,
              teacher: { select: { name: true } },
              studentNotes: { where: { studentId: session.studentId }, select: { note: true } },
            },
          },
        },
      });
      lectureList = targets.map((t) => t.lecture);
    }

    const lectures = lectureList
      .filter((l) => l.status === 'PUBLISHED')
      .sort((a, b) => {
        if (a.seriesId !== b.seriesId)
          return (a.seriesId ?? '').localeCompare(b.seriesId ?? '');
        if ((a.episodeNumber ?? 0) !== (b.episodeNumber ?? 0))
          return (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0);
        return a.orderIndex - b.orderIndex;
      })
      .map((l) => ({
        lectureId: l.id,
        title: l.title,
        description: l.description,
        duration: l.duration,
        cfVideoId: l.cfVideoId,
        videoUrl: l.videoUrl,
        teacherName: l.teacher?.name ?? null,
        note: l.studentNotes[0]?.note ?? null,
      }));

    return NextResponse.json({ lectures });
  } catch (err) {
    console.error('[GET /api/ingang-tablet/lectures]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
