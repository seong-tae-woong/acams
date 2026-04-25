import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// PATCH /api/classes/[id]/textbooks/[tbId]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; tbId: string }> }
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tbId } = await ctx.params;

  try {
    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.publisher !== undefined) updateData.publisher = body.publisher;
    if (body.unit !== undefined) updateData.unit = body.unit;
    if (body.totalUnits !== undefined) updateData.totalUnits = body.totalUnits;
    if (body.currentUnit !== undefined) updateData.currentUnit = body.currentUnit;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.isbn !== undefined) updateData.isbn = body.isbn;
    if (body.purchaseDate !== undefined) updateData.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null;
    if (body.memo !== undefined) updateData.memo = body.memo;

    const tb = await prisma.textbook.update({
      where: { id: tbId, academyId },
      data: updateData,
    });

    return NextResponse.json({
      id: tb.id, classId: tb.classId, name: tb.name, publisher: tb.publisher,
      unit: tb.unit, totalUnits: tb.totalUnits, currentUnit: tb.currentUnit, price: tb.price,
      isbn: tb.isbn, purchaseDate: tb.purchaseDate ? tb.purchaseDate.toISOString().slice(0, 10) : '', memo: tb.memo,
    });
  } catch (err) {
    console.error('[PATCH /api/classes/[id]/textbooks/[tbId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/classes/[id]/textbooks/[tbId]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; tbId: string }> }
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tbId } = await ctx.params;

  try {
    await prisma.textbook.delete({ where: { id: tbId, academyId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/classes/[id]/textbooks/[tbId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
