import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { AnnouncementStatus as PrismaStatus } from '@/generated/prisma/client';
import { validateSession } from '@/lib/auth/validateSession';

const STATUS_TO_UI: Record<PrismaStatus, '임시저장' | '게시됨'> = {
  DRAFT: '임시저장',
  PUBLISHED: '게시됨',
};

const STATUS_TO_PRISMA: Record<string, PrismaStatus> = {
  '임시저장': PrismaStatus.DRAFT,
  '게시됨': PrismaStatus.PUBLISHED,
};

function mapAnnouncement(a: {
  id: string; title: string; content: string; authorId: string;
  status: PrismaStatus; pinned: boolean; publishedAt: Date | null;
  createdAt: Date; classId: string | null;
  class?: { id: string; name: string } | null;
}) {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    author: a.authorId,
    status: STATUS_TO_UI[a.status],
    pinned: a.pinned,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    classId: a.classId,
    className: a.class?.name ?? null,
    readCount: 0,
    totalCount: 0,
    targetAudience: a.classId ? [a.classId] : ['all'],
    attachments: [],
  };
}

// GET /api/communication/announcements
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const announcements = await prisma.announcement.findMany({
      where: { academyId },
      include: { class: { select: { id: true, name: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(announcements.map(mapAnnouncement));
  } catch (err) {
    console.error('[GET /api/communication/announcements]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/communication/announcements
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionError = await validateSession(req);
  if (sessionError) return sessionError;

  const userId = req.headers.get('x-user-id') ?? '';

  try {
    const { title, content, status, pinned, classId } = await req.json();
    if (!title || !content) {
      return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400 });
    }

    const prismaStatus = STATUS_TO_PRISMA[status ?? '임시저장'] ?? PrismaStatus.DRAFT;

    const announcement = await prisma.announcement.create({
      data: {
        academyId,
        title,
        content,
        authorId: userId,
        status: prismaStatus,
        pinned: pinned ?? false,
        publishedAt: prismaStatus === PrismaStatus.PUBLISHED ? new Date() : null,
        classId: classId ?? null,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(mapAnnouncement(announcement), { status: 201 });
  } catch (err) {
    console.error('[POST /api/communication/announcements]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
