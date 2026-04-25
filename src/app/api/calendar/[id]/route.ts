import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// DELETE /api/calendar/[id] — 일정 삭제
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = req.headers.get('x-user-role');
  if (role !== 'director' && role !== 'teacher' && role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const event = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!event || event.academyId !== academyId) {
      return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/calendar/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
