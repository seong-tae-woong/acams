import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/mobile/notifications
// 현재 로그인한 학생/학부모의 수납 알림만 반환
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let studentId: string | null = null;

    if (role === 'student') {
      const s = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true },
      });
      studentId = s?.id ?? null;
    } else if (role === 'parent') {
      // 부모는 자녀 중 첫 번째 학생 기준 (다자녀는 추후 확장)
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: { student: { select: { id: true } } },
            take: 1,
          },
        },
      });
      studentId = parent?.children[0]?.student.id ?? null;
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 이 학생이 수신자로 포함된 알림만 조회
    const recipients = await prisma.notificationRecipient.findMany({
      where: { studentId },
      include: {
        notification: true,
      },
      orderBy: {
        notification: { sentAt: 'desc' },
      },
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

    // 읽음 처리: 조회 시 readAt 업데이트 (아직 읽지 않은 것만)
    const unreadIds = recipients
      .filter((r) => !r.readAt)
      .map((r) => ({ notificationId: r.notificationId, studentId: r.studentId }));

    if (unreadIds.length > 0) {
      await Promise.all(
        unreadIds.map((r) =>
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
