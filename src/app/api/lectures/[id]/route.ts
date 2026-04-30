import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { LectureStatus } from '@/generated/prisma/client';

// GET /api/lectures/[id]
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const lecture = await prisma.lecture.findFirst({
      where: { id, academyId },
      include: { teacher: { select: { name: true } } },
    });
    if (!lecture) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json(lecture);
  } catch (err) {
    console.error('[GET /api/lectures/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/lectures/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const { title, description, teacherId, subjects, levels, targetGrades, videoUrl, duration, orderIndex, status } = body;

    const updated = await prisma.lecture.updateMany({
      where: { id, academyId },
      data: {
        ...(title !== undefined       ? { title: title.trim() }                   : {}),
        ...(description !== undefined ? { description }                            : {}),
        ...(teacherId !== undefined   ? { teacherId: teacherId ?? null }           : {}),
        ...(subjects !== undefined    ? { subjects }                               : {}),
        ...(levels !== undefined      ? { levels }                                 : {}),
        ...(targetGrades !== undefined ? { targetGrades }                          : {}),
        ...(videoUrl !== undefined    ? { videoUrl: videoUrl ?? null }             : {}),
        ...(duration !== undefined    ? { duration }                               : {}),
        ...(orderIndex !== undefined  ? { orderIndex }                             : {}),
        ...(status !== undefined      ? { status: status as LectureStatus }        : {}),
      },
    });

    if (updated.count === 0) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/lectures/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/lectures/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    await prisma.lecture.deleteMany({ where: { id, academyId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/lectures/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
