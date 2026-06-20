import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

type Ctx = { params: Promise<{ id: string }> };

function isStaff(role: string) {
  return role === 'director' || role === 'teacher' || role === 'super_admin';
}

// PATCH /api/level-test-comment-templates/[id] — 수정. body: { title?, body? }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (!isStaff(role)) return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  const { id } = await ctx.params;

  try {
    const exists = await prisma.levelTestCommentTemplate.findFirst({ where: { id, academyId, isActive: true }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: '양식을 찾을 수 없습니다.' }, { status: 404 });

    const body = await req.json();
    const data: { title?: string; body?: string } = {};
    if (typeof body.title === 'string') {
      if (!body.title.trim()) return NextResponse.json({ error: '제목은 비울 수 없습니다.' }, { status: 400 });
      data.title = body.title.trim();
    }
    if (typeof body.body === 'string') {
      if (!body.body.trim()) return NextResponse.json({ error: '코멘트 내용은 비울 수 없습니다.' }, { status: 400 });
      data.body = body.body.trim();
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });

    const updated = await prisma.levelTestCommentTemplate.update({
      where: { id },
      data,
      select: { id: true, title: true, body: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/level-test-comment-templates/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/level-test-comment-templates/[id] — 소프트 삭제
//   (발행된 리포트는 코멘트 본문을 복사 보관하므로 영향 없음)
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (!isStaff(role)) return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  const { id } = await ctx.params;

  try {
    const exists = await prisma.levelTestCommentTemplate.findFirst({ where: { id, academyId, isActive: true }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: '양식을 찾을 수 없습니다.' }, { status: 404 });

    await prisma.levelTestCommentTemplate.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/level-test-comment-templates/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
