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

// GET /api/communication/notifications?month=YYYY-MM
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = new URL(req.url).searchParams.get('month');
  const monthFilter = (() => {
    if (!month) return {};
    const [y, mo] = month.split('-').map(Number);
    const ny = mo === 12 ? y + 1 : y;
    const nm = mo === 12 ? 1 : mo + 1;
    return { sentAt: { gte: new Date(`${month}-01T00:00:00+09:00`), lt: new Date(`${ny}-${String(nm).padStart(2, '0')}-01T00:00:00+09:00`) } };
  })();

  try {
    const notifications = await prisma.notification.findMany({
      where: { academyId, ...monthFilter },
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
      readRecipients: n.recipients.filter((r) => r.readAt !== null).map((r) => r.studentId),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/communication/notifications]', err instanceof Error ? err.message : String(err));
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
    const validBillIds = Array.isArray(billIds) && billIds.length > 0 ? (billIds as string[]) : [];
    const metadata = validBillIds.length > 0 ? { billIds: validBillIds } : undefined;

    // 수납알림의 billIds가 실제로 수신자(학생)의 청구서인지 검증 — 타 학생 청구서 혼입 방지
    if (prismaType === PrismaType.PAYMENT_ALERT && validBillIds.length > 0) {
      const bills = await prisma.bill.findMany({
        where: { id: { in: validBillIds }, academyId },
        select: { studentId: true },
      });
      if (bills.length !== validBillIds.length) {
        return NextResponse.json({ error: '존재하지 않는 청구서가 포함되어 있습니다.' }, { status: 400 });
      }
      const recipientSet = new Set(recipientIds);
      const allBelongToRecipients = bills.every((b) => recipientSet.has(b.studentId));
      if (!allBelongToRecipients) {
        return NextResponse.json({ error: '수신자의 청구서가 아닌 항목이 포함되어 있습니다.' }, { status: 400 });
      }
    }

    const now = new Date();

    const notification = await prisma.$transaction(async (tx) => {
      const notif = await tx.notification.create({
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

      // 수납알림 발송 시 해당 청구서에 발송 시각 기록
      if (prismaType === PrismaType.PAYMENT_ALERT && validBillIds.length > 0) {
        await tx.bill.updateMany({
          where: { id: { in: validBillIds }, academyId },
          data: { notifiedAt: now },
        });
      }

      return notif;
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
      readRecipients: [],
      billIds: meta?.billIds ?? [],
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/communication/notifications]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
