import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { LectureStatus } from '@/generated/prisma/client';

// GET /api/lecture-series/[id]
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const series = await prisma.lectureSeries.findFirst({
      where: { id, academyId },
      include: { _count: { select: { lectures: true } } },
    });
    if (!series) return NextResponse.json({ error: '시리즈를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json(series);
  } catch (err) {
    console.error('[GET /api/lecture-series/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/lecture-series/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const { title, description, orderIndex, status } = body;

    const updated = await prisma.lectureSeries.updateMany({
      where: { id, academyId },
      data: {
        ...(title !== undefined       ? { title: title.trim() }             : {}),
        ...(description !== undefined ? { description }                      : {}),
        ...(orderIndex !== undefined  ? { orderIndex }                       : {}),
        ...(status !== undefined      ? { status: status as LectureStatus }  : {}),
      },
    });

    if (updated.count === 0) return NextResponse.json({ error: '시리즈를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/lecture-series/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/lecture-series/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    await prisma.lectureSeries.deleteMany({ where: { id, academyId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/lecture-series/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
