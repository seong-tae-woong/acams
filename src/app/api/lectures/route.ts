import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { LectureStatus } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';
import { resolveDurationSec } from '@/lib/ingang/cloudflareStream';

// GET /api/lectures
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const lectures = await prisma.lecture.findMany({
      where: { academyId },
      include: { teacher: { select: { name: true } } },
      orderBy: [{ seriesId: 'asc' }, { episodeNumber: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(lectures);
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/lectures]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/lectures
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, description, teacherId, subjects, levels, targetGrades, etcTags, cfVideoId, videoUrl, duration, orderIndex, status, seriesId, episodeNumber } = body;

    if (!title?.trim()) return NextResponse.json({ error: '강의명은 필수입니다.' }, { status: 400 });

    // cfVideoId가 새로 stamp되면 Cloudflare Stream에서 durationSec 1회 조회 (인코딩 완료 시).
    // 진도율 게이트의 서버 진실 원천. 인코딩 미완료 또는 실패 시 NULL → backfill 스크립트 또는 다음 PATCH 때 재시도.
    const durationSec = cfVideoId ? await resolveDurationSec(cfVideoId) : null;

    const lecture = await prisma.lecture.create({
      data: {
        academyId,
        title: title.trim(),
        description: description ?? '',
        teacherId: teacherId ?? null,
        subjects: subjects ?? [],
        levels: levels ?? [],
        targetGrades: targetGrades ?? [],
        etcTags: etcTags ?? [],
        cfVideoId: cfVideoId ?? null,
        videoUrl: videoUrl ?? null,
        duration: duration ?? '--:--',
        durationSec,
        orderIndex: orderIndex ?? 0,
        status: (status as LectureStatus) ?? LectureStatus.DRAFT,
        seriesId: seriesId ?? null,
        episodeNumber: episodeNumber ?? null,
      },
      include: { teacher: { select: { name: true } } },
    });

    return NextResponse.json(lecture, { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/lectures]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
