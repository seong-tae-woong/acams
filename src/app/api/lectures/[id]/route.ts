import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { LectureStatus } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';
import { resolveDurationSec } from '@/lib/ingang/cloudflareStream';

// GET /api/lectures/[id]
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const lecture = await prisma.lecture.findFirst({
      where: { id, academyId },
      include: { teacher: { select: { name: true } } },
    });
    if (!lecture) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json(lecture);
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/lectures/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/lectures/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const { title, description, teacherId, subjects, levels, targetGrades, etcTags, videoUrl, cfVideoId, duration, orderIndex, status, seriesId, episodeNumber } = body;

    // cfVideoId가 변경되었으면 durationSec 재조회.
    // - 영상 교체: 새 durationSec로 stamp + LectureWatchProgress의 cfVideoId mismatch로 진도 자동 재시작 처리됨
    // - cfVideoId 새로 추가: durationSec 채움 시도
    // - 인코딩 미완료: NULL (backfill에서 재시도)
    let durationSecPatch: { durationSec?: number | null } = {};
    if (cfVideoId !== undefined) {
      const prior = await prisma.lecture.findFirst({ where: { id, academyId }, select: { cfVideoId: true } });
      if (prior && prior.cfVideoId !== cfVideoId) {
        durationSecPatch = { durationSec: await resolveDurationSec(cfVideoId) };
      }
    }

    const updated = await prisma.lecture.updateMany({
      where: { id, academyId },
      data: {
        ...(title !== undefined         ? { title: title.trim() }                   : {}),
        ...(description !== undefined   ? { description }                            : {}),
        ...(teacherId !== undefined     ? { teacherId: teacherId ?? null }           : {}),
        ...(subjects !== undefined      ? { subjects }                               : {}),
        ...(levels !== undefined        ? { levels }                                 : {}),
        ...(targetGrades !== undefined  ? { targetGrades }                           : {}),
        ...(etcTags !== undefined       ? { etcTags }                                : {}),
        ...(videoUrl !== undefined      ? { videoUrl: videoUrl ?? null }             : {}),
        ...(cfVideoId !== undefined     ? { cfVideoId: cfVideoId ?? null }           : {}),
        ...durationSecPatch,
        ...(duration !== undefined      ? { duration }                               : {}),
        ...(orderIndex !== undefined    ? { orderIndex }                             : {}),
        ...(status !== undefined        ? { status: status as LectureStatus }        : {}),
        ...(seriesId !== undefined      ? { seriesId: seriesId ?? null }             : {}),
        ...(episodeNumber !== undefined ? { episodeNumber: episodeNumber ?? null }   : {}),
      },
    });

    if (updated.count === 0) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    await logServerError(req, err);
    console.error('[PATCH /api/lectures/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/lectures/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    await prisma.lecture.deleteMany({ where: { id, academyId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    await logServerError(req, err);
    console.error('[DELETE /api/lectures/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
