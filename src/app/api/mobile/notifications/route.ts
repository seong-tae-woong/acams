import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/mobile/notifications
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let studentIds: string[] = [];

    if (role === 'student') {
      const s = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true },
      });
      if (s) studentIds = [s.id];
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: { student: { select: { id: true } } },
          },
        },
      });
      studentIds = parent?.children.map((c) => c.student.id) ?? [];
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    if (studentIds.length === 0) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 모든 자녀가 수신자로 포함된 알림 조회
    const recipients = await prisma.notificationRecipient.findMany({
      where: { studentId: { in: studentIds } },
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

    // 같은 알림이 여러 자녀에게 발송된 경우 중복 제거 (notificationId 기준)
    // readAt: 자녀 중 하나라도 읽었으면 읽음으로 표시
    const notifMap = new Map<string, typeof recipients[number]>();
    for (const r of recipients) {
      const existing = notifMap.get(r.notificationId);
      if (!existing || (!existing.readAt && r.readAt)) {
        notifMap.set(r.notificationId, r);
      }
    }

    const result = Array.from(notifMap.values()).map((r) => {
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

    // 읽음 처리: 모든 자녀의 미읽음 레코드 일괄 업데이트
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
