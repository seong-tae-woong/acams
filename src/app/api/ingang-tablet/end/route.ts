/**
 * POST /api/ingang-tablet/end
 *
 * 시청 세션 종료 (학생이 "끝내기" 버튼 또는 무동작 타임아웃).
 * role=tablet 전용.
 *
 * body: { sessionId }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  const academyId = req.headers.get('x-academy-id');

  if (role !== 'tablet' || !academyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });

    await prisma.ingangViewSession.updateMany({
      where: {
        id: sessionId,
        academyId,
        status: { in: ['APPROVED', 'PENDING'] },
      },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/ingang-tablet/end]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
