import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { AnnouncementStatus as PrismaStatus } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';

// PATCH /api/communication/announcements/[id] — 수정 또는 게시
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const { title, content, status, pinned } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (pinned !== undefined) updateData.pinned = pinned;
    if (status === '게시됨') {
      updateData.status = PrismaStatus.PUBLISHED;
      updateData.publishedAt = new Date();
    } else if (status === '임시저장') {
      updateData.status = PrismaStatus.DRAFT;
      updateData.publishedAt = null;
    }

    const updated = await prisma.announcement.update({
      where: { id, academyId },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      content: updated.content,
      author: updated.authorId,
      status: updated.status === PrismaStatus.PUBLISHED ? '게시됨' : '임시저장',
      pinned: updated.pinned,
      publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      readCount: 0,
      totalCount: 0,
      targetAudience: ['all'],
      attachments: [],
    });
  } catch (err) {
    console.error('[PATCH /api/communication/announcements/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/communication/announcements/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    await prisma.announcement.delete({ where: { id, academyId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/communication/announcements/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
