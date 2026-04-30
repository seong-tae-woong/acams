import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// DELETE /api/communication/notification-templates/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const template = await prisma.notificationTemplate.findFirst({ where: { id, academyId } });
    if (!template) return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 });

    await prisma.notificationTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/communication/notification-templates/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
