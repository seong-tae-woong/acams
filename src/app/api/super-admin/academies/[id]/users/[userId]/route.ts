import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { validatePassword } from '@/lib/auth/passwordValidator';

function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

type RouteContext = { params: Promise<{ id: string; userId: string }> };

// PATCH /api/super-admin/academies/[id]/users/[userId]
// body: { isActive?, newPassword?, email?, name? }
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
  const { isActive, newPassword, email, name } = body as {
    isActive?: boolean;
    newPassword?: string;
    email?: string;
    name?: string;
  };

  if (newPassword !== undefined) {
    const pwValidation = validatePassword(newPassword);
    if (!pwValidation.valid) {
      return NextResponse.json({ error: pwValidation.error }, { status: 400 });
    }
  }

  // 이메일 변경 시 중복 검사
  let normalizedEmail: string | undefined;
  if (email !== undefined) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });
    }
    if (trimmed !== (user.email ?? '').toLowerCase()) {
      const conflict = await prisma.user.findUnique({ where: { email: trimmed } });
      if (conflict && conflict.id !== userId) {
        return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });
      }
    }
    normalizedEmail = trimmed;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(newPassword !== undefined && { passwordHash: await bcrypt.hash(newPassword, 12) }),
      ...(normalizedEmail !== undefined && { email: normalizedEmail }),
      ...(name !== undefined && name.trim() && { name: name.trim() }),
      // 비밀번호/이메일 변경 시 기존 토큰 무효화
      ...(((newPassword !== undefined) || (normalizedEmail !== undefined && normalizedEmail !== (user.email ?? '').toLowerCase()))
        && { tokenVersion: { increment: 1 } }),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/super-admin/academies/[id]/users/[userId] — 계정 삭제
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, userId } = await ctx.params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.academyId !== id) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 학원에 원장이 1명만 남았다면 삭제 차단 (운영 안전장치)
  if (user.role === 'director') {
    const directorCount = await prisma.user.count({
      where: { academyId: id, role: 'director' },
    });
    if (directorCount <= 1) {
      return NextResponse.json(
        { error: '학원에는 최소 1명의 원장 계정이 필요합니다. 새 원장을 먼저 추가한 뒤 삭제해주세요.' },
        { status: 400 },
      );
    }
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (err) {
    console.error('[super-admin user DELETE]', err);
    return NextResponse.json(
      { error: '계정에 연결된 데이터가 있어 삭제할 수 없습니다. 비활성화로 대체해주세요.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
