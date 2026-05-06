import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { NotificationType as PrismaType } from '@/generated/prisma/client';

const TYPE_TO_UI: Record<PrismaType, string> = {
  ANNOUNCEMENT:       '공지',
  ATTENDANCE_ALERT:   '출결알림',
  PAYMENT_ALERT:      '수납알림',
  CONSULTATION_ALERT: '상담알림',
  GENERAL:            '일반',
};

const TYPE_TO_PRISMA: Record<string, PrismaType> = {
  '공지':    PrismaType.ANNOUNCEMENT,
  '출결알림': PrismaType.ATTENDANCE_ALERT,
  '수납알림': PrismaType.PAYMENT_ALERT,
  '상담알림': PrismaType.CONSULTATION_ALERT,
  '일반':    PrismaType.GENERAL,
};

// GET /api/communication/notification-templates
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const templates = await prisma.notificationTemplate.findMany({
      where: { academyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      templates.map((t) => ({
        id:        t.id,
        category:  TYPE_TO_UI[t.category],
        title:     t.title,
        content:   t.content,
        createdAt: t.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    console.error('[GET /api/communication/notification-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/communication/notification-templates
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { category, title, content } = await req.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400 });
    }

    const prismaCategory = TYPE_TO_PRISMA[category] ?? PrismaType.GENERAL;

    const template = await prisma.notificationTemplate.create({
      data: { academyId, category: prismaCategory, title: title.trim(), content: content.trim() },
    });

    return NextResponse.json(
      {
        id:        template.id,
        category:  TYPE_TO_UI[template.category],
        title:     template.title,
        content:   template.content,
        createdAt: template.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/communication/notification-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
