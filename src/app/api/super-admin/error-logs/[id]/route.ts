import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

// PATCH /api/super-admin/error-logs/[id] — 처리완료(resolved) 토글
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const updated = await prisma.errorLog.update({
    where: { id },
    data: { resolved: Boolean(body.resolved) },
  });
  return NextResponse.json(updated);
}

// DELETE /api/super-admin/error-logs/[id] — 단건 삭제(노이즈 정리용)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.errorLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
