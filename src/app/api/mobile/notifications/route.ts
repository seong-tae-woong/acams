import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';

// GET /api/mobile/notifications?studentId=
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
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const recipients = await prisma.notificationRecipient.findMany({
      where: { studentId },
      include: { notification: true },
      orderBy: { notification: { sentAt: 'desc' } },
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

    const unreadRecipients = recipients.filter((r) => !r.readAt);
    if (unreadRecipients.length > 0) {
      await Promise.all(
        unreadRecipients.map((r) =>
          prisma.notificationRecipient.update({
            where: {
              notificationId_studentId: {
                notificationId: r.notificationId,
                studentId: r.studentId,
              },
            },
            data: { readAt: new Date() },
          })
        )
      );
    }

    return NextResponse.json({ notifications: result });
  } catch (err) {
    console.error('[GET /api/mobile/notifications]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
