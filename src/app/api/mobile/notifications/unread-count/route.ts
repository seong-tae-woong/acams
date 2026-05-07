import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';

// GET /api/mobile/notifications/unread-count?studentId=
// 하단 탭바 알림 배지용 — 미읽음 개수만 가볍게 반환 (read 처리 없음)
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const requestedStudentId = new URL(req.url).searchParams.get('studentId');

  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.notificationRecipient.count({
      where: { studentId, readAt: null },
    });

    return NextResponse.json({ count });
  } catch (err) {
    console.error('[GET /api/mobile/notifications/unread-count]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ count: 0 });
  }
}
