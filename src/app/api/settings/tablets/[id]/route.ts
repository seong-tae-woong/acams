import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

function onlyDirector(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  return role === 'director' || role === 'super_admin';
}

// PATCH /api/settings/tablets/[id] — 활성화/비활성화, 비밀번호 재설정, 이름 변경
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!onlyDirector(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { isActive, newPassword, name } = body ?? {};

    const tablet = await prisma.user.findFirst({ where: { id, academyId, role: 'tablet' } });
    if (!tablet) return NextResponse.json({ error: '태블릿 계정을 찾을 수 없습니다.' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (name?.trim()) updateData.name = name.trim();
    if (newPassword?.trim()) {
      updateData.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      updateData.tokenVersion = { increment: 1 };
    }
    if (isActive === false) {
      updateData.tokenVersion = { increment: 1 };
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, loginId: true, isActive: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/settings/tablets/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/settings/tablets/[id] — 태블릿 계정 삭제
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!onlyDirector(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;

    const tablet = await prisma.user.findFirst({ where: { id, academyId, role: 'tablet' } });
    if (!tablet) return NextResponse.json({ error: '태블릿 계정을 찾을 수 없습니다.' }, { status: 404 });

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/settings/tablets/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
