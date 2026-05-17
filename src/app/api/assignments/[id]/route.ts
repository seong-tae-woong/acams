import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/assignments/[id]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;
  const { id } = await ctx.params;

  try {
    const found = await prisma.assignment.findFirst({ where: { id, academyId } });
    if (!found) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 });

    const { date, dueDate, memo } = await req.json();
    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        ...(date ? { date: new Date(date) } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(memo !== undefined ? { memo } : {}),
      },
      include: { class: { select: { name: true, subject: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      classId: updated.classId,
      className: updated.class.name,
      classSubject: updated.class.subject,
      date: updated.date.toISOString().slice(0, 10),
      dueDate: updated.dueDate.toISOString().slice(0, 10),
      memo: updated.memo,
    });
  } catch (err) {
    console.error('[PATCH /api/assignments/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/assignments/[id]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;
  const { id } = await ctx.params;

  try {
    const found = await prisma.assignment.findFirst({ where: { id, academyId } });
    if (!found) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 });

    await prisma.assignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/assignments/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
