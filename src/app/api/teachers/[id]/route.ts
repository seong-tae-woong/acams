import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// PATCH /api/teachers/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    });
  } catch (err) {
    console.error('[PATCH /api/teachers/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
