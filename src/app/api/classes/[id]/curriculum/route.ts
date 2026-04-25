import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/classes/[id]/curriculum
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: classId } = await ctx.params;

  try {
    const rows = await prisma.curriculumRow.findMany({
      where: { academyId, classId },
      orderBy: { week: 'asc' },
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        week: r.week,
        topic: r.topic,
        detail: r.detail,
        done: r.done,
      }))
    );
  } catch (err) {
    console.error('[GET /api/classes/[id]/curriculum]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/classes/[id]/curriculum — 주차 추가
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: classId } = await ctx.params;

  try {
    const { topic, detail } = await req.json();
    if (!topic) return NextResponse.json({ error: '학습 주제는 필수입니다.' }, { status: 400 });

    // 다음 주차 자동 계산
    const last = await prisma.curriculumRow.findFirst({
      where: { classId },
      orderBy: { week: 'desc' },
    });
    const nextWeek = (last?.week ?? 0) + 1;

    const row = await prisma.curriculumRow.create({
      data: {
        academyId,
        classId,
        week: nextWeek,
        topic,
        detail: detail ?? '',
        done: false,
      },
    });

    return NextResponse.json(
      { id: row.id, week: row.week, topic: row.topic, detail: row.detail, done: row.done },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/classes/[id]/curriculum]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
