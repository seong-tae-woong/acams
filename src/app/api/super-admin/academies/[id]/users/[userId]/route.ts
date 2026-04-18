import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

type RouteContext = { params: Promise<{ id: string; userId: string }> };

// PATCH /api/super-admin/academies/[id]/users/[userId]
// body: { isActive?: boolean, newPassword?: string }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, userId } = await ctx.params;

  // 해당 유저가 이 학원 소속인지 확인
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.academyId !== id) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }

  const body = await req.json();
  const { isActive, newPassword } = body;

  if (newPassword !== undefined && newPassword.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(newPassword !== undefined && { passwordHash: await bcrypt.hash(newPassword, 12) }),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json(updated);
}
