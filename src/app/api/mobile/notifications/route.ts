import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';

const PAGE_SIZE = 10;

// GET /api/mobile/notifications?studentId=&page=1
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

  const url = new URL(req.url);
  const requestedStudentId = url.searchParams.get('studentId');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const total = await prisma.notificationRecipient.count({ where: { studentId } });

    const recipients = await prisma.notificationRecipient.findMany({
      where: { studentId },
      include: { notification: true },
      orderBy: { notification: { sentAt: 'desc' } },
      skip,
      take: PAGE_SIZE,
    });

    const TYPE_TO_UI: Record<string, string> = {
      ANNOUNCEMENT: '공지',
      ATTENDANCE_ALERT: '출결알림',
      PAYMENT_ALERT: '수납알림',
      CONSULTATION_ALERT: '상담알림',
      GENERAL: '일반',
    };

    const result = recipients.map((r) => {
      const meta = r.notification.metadata as { billIds?: string[] } | null;
      return {
        id: r.notification.id,
        type: TYPE_TO_UI[r.notification.type] ?? '일반',
        title: r.notification.title,
        content: r.notification.content,
        sentAt: r.notification.sentAt.toISOString(),
        readAt: r.readAt ? r.readAt.toISOString() : null,
        billIds: meta?.billIds ?? [],
      };
    });

    // 첫 페이지 진입 시에만 이 학생의 모든 미읽음을 일괄 read 처리 (배지 클리어)
    if (page === 1) {
      await prisma.notificationRecipient.updateMany({
        where: { studentId, readAt: null },
        data: { readAt: new Date() },
      });
    }

    const hasMore = skip + recipients.length < total;

    return NextResponse.json({ notifications: result, hasMore, page, total });
  } catch (err) {
    console.error('[GET /api/mobile/notifications]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
