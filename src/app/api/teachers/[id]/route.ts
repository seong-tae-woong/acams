import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// PATCH /api/teachers/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '강사를 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { name, subject, phone, email, avatarColor, isActive, permissions } = body;

    const updated = await prisma.teacher.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(subject !== undefined && { subject }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(avatarColor !== undefined && { avatarColor }),
        ...(isActive !== undefined && { isActive }),
        ...(permissions !== undefined && { permissions }),
      },
      include: { classes: { select: { classId: true } } },
    });

    // 권한 변경 시 연결된 강사 계정의 tokenVersion 증가 → 기존 토큰 무효화(재로그인 후 새 권한 반영)
    if (permissions !== undefined && existing.userId) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { tokenVersion: { increment: 1 } },
      });
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      subject: updated.subject,
      phone: updated.phone,
      email: updated.email,
      avatarColor: updated.avatarColor,
      isActive: updated.isActive,
      permissions: updated.permissions,
      classes: updated.classes.map((c) => c.classId),
      userId: updated.userId,
    });
  } catch (err) {
    console.error('[PATCH /api/teachers/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
