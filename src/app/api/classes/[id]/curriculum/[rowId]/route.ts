import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// PATCH /api/classes/[id]/curriculum/[rowId]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; rowId: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { rowId } = await ctx.params;

  try {
    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.topic !== undefined) updateData.topic = body.topic;
    if (body.detail !== undefined) updateData.detail = body.detail;
    if (body.done !== undefined) updateData.done = body.done;
    if (body.unitType !== undefined && ['MONTH', 'WEEK', 'SESSION'].includes(body.unitType)) {
      updateData.unitType = body.unitType;
    }
    if (typeof body.startWeek === 'number' && body.startWeek > 0) updateData.startWeek = body.startWeek;
    if (typeof body.endWeek === 'number' && body.endWeek > 0) updateData.endWeek = body.endWeek;
    if (body.color !== undefined) updateData.color = body.color || null;

    const row = await prisma.curriculumRow.update({
      where: { id: rowId, academyId },
      data: updateData,
    });

    return NextResponse.json({
      id: row.id, unitType: row.unitType,
      startWeek: row.startWeek, endWeek: row.endWeek,
      topic: row.topic, detail: row.detail, color: row.color, done: row.done,
    });
  } catch (err) {
    console.error('[PATCH /api/classes/[id]/curriculum/[rowId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/classes/[id]/curriculum/[rowId]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; rowId: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { rowId } = await ctx.params;

  try {
    await prisma.curriculumRow.delete({ where: { id: rowId, academyId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/classes/[id]/curriculum/[rowId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
