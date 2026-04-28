import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { NotificationType as PrismaType } from '@/generated/prisma/client';

const TYPE_TO_UI: Record<PrismaType, string> = {
  ANNOUNCEMENT: '공지',
  ATTENDANCE_ALERT: '출결알림',
  PAYMENT_ALERT: '수납알림',
  CONSULTATION_ALERT: '상담알림',
  GENERAL: '일반',
};

const TYPE_TO_PRISMA: Record<string, PrismaType> = {
  '공지': PrismaType.ANNOUNCEMENT,
  '출결알림': PrismaType.ATTENDANCE_ALERT,
  '수납알림': PrismaType.PAYMENT_ALERT,
  '상담알림': PrismaType.CONSULTATION_ALERT,
  '일반': PrismaType.GENERAL,
};

// GET /api/communication/notifications
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const notifications = await prisma.notification.findMany({
      where: { academyId },
      include: { recipients: true },
      orderBy: { sentAt: 'desc' },
    });

    const result = notifications.map((n) => ({
      id: n.id,
      type: TYPE_TO_UI[n.type],
      title: n.title,
      content: n.content,
      sentAt: n.sentAt.toISOString(),
      sentBy: n.sentById,
      recipients: n.recipients.map((r) => r.studentId),
      readCount: n.recipients.filter((r) => r.readAt !== null).length,
      totalCount: n.recipients.length,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/communication/notifications]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/communication/notifications
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = req.headers.get('x-user-id') ?? '';

  try {
    const { type, title, content, recipients, billIds } = await req.json();

    if (!title || !content) {
      return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400 });
    }

    const prismaType = TYPE_TO_PRISMA[type ?? '일반'] ?? PrismaType.GENERAL;
    const recipientIds: string[] = Array.isArray(recipients) ? recipients : [];

    // 수납알림에 billIds가 있으면 metadata에 저장
    const metadata = Array.isArray(billIds) && billIds.length > 0
      ? { billIds }
      : undefined;

    const notification = await prisma.notification.create({
      data: {
        academyId,
        type: prismaType,
        title,
        content,
        metadata,
        sentById: userId,
        recipients: {
          create: recipientIds.map((studentId) => ({ studentId })),
        },
      },
      include: { recipients: true },
    });

    const meta = notification.metadata as { billIds?: string[] } | null;

    return NextResponse.json({
      id: notification.id,
      type: TYPE_TO_UI[notification.type],
      title: notification.title,
      content: notification.content,
      sentAt: notification.sentAt.toISOString(),
      sentBy: notification.sentById,
      recipients: notification.recipients.map((r) => r.studentId),
      readCount: 0,
      totalCount: notification.recipients.length,
      billIds: meta?.billIds ?? [],
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/communication/notifications]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
