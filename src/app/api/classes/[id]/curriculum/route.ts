import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type CurriculumUnitType = 'MONTH' | 'WEEK' | 'SESSION';
const VALID_TYPES: CurriculumUnitType[] = ['MONTH', 'WEEK', 'SESSION'];

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
      orderBy: [{ unitType: 'asc' }, { startWeek: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        unitType: r.unitType,
        startWeek: r.startWeek,
        endWeek: r.endWeek,
        topic: r.topic,
        detail: r.detail,
        color: r.color,
        done: r.done,
      }))
    );
  } catch (err) {
    console.error('[GET /api/classes/[id]/curriculum]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/classes/[id]/curriculum
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: classId } = await ctx.params;

  try {
    const { topic, detail, unitType, startWeek, endWeek, color } = await req.json();
    if (!topic) return NextResponse.json({ error: '단원명은 필수입니다.' }, { status: 400 });

    const type: CurriculumUnitType = VALID_TYPES.includes(unitType) ? unitType : 'WEEK';
    const start = typeof startWeek === 'number' && startWeek > 0 ? startWeek : 1;
    let end = typeof endWeek === 'number' && endWeek > 0 ? endWeek : start;
    if (end < start) end = start;

    const row = await prisma.curriculumRow.create({
      data: {
        academyId,
        classId,
        unitType: type,
        startWeek: start,
        endWeek: end,
        topic,
        detail: detail ?? '',
        color: typeof color === 'string' && color ? color : null,
        done: false,
      },
    });

    return NextResponse.json(
      {
        id: row.id, unitType: row.unitType,
        startWeek: row.startWeek, endWeek: row.endWeek,
        topic: row.topic, detail: row.detail, color: row.color, done: row.done,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/classes/[id]/curriculum]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
