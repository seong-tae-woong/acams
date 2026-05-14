import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// PATCH /api/communication/report-templates/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const exist = await prisma.reportTemplate.findFirst({ where: { id, academyId } });
    if (!exist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string') data.name = body.name.trim();
    if (typeof body.alias === 'string') data.alias = body.alias.trim();
    if (typeof body.bodyMarkdown === 'string') data.bodyMarkdown = body.bodyMarkdown;
    if (body.layout !== undefined) data.layout = body.layout;
    if (body.scopeFilter !== undefined) data.scopeFilter = body.scopeFilter;
    if (typeof body.passThreshold === 'number') data.passThreshold = body.passThreshold;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (body.periodMonths === null) data.periodMonths = null;
    else if (typeof body.periodMonths === 'number') data.periodMonths = body.periodMonths;

    const updated = await prisma.reportTemplate.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH report-templates/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// DELETE /api/communication/report-templates/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const exist = await prisma.reportTemplate.findFirst({ where: { id, academyId } });
    if (!exist) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.reportTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE report-templates/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '발행된 레포트가 있어 삭제할 수 없습니다.' }, { status: 500 });
  }
}
