import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/super-admin/academies/[id]
export async function GET(req: NextRequest, ctx: RouteContext) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  const academy = await prisma.academy.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { students: true, classes: true } },
    },
  });

  if (!academy) {
    return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json(academy);
}

// PATCH /api/super-admin/academies/[id]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.academy.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });
  }

  const body = await req.json();
  const { name, loginKey, phone, address, isActive } = body;

  // loginKey 유효성 검사
  if (loginKey !== undefined && loginKey !== '' && loginKey !== null) {
    if (!/^[A-Z]{3}$/.test(loginKey)) {
      return NextResponse.json({ error: '학원 키는 영문 대문자 3글자여야 합니다. (예: SGR)' }, { status: 400 });
    }
    const conflict = await prisma.academy.findFirst({ where: { loginKey, NOT: { id } } });
    if (conflict) {
      return NextResponse.json({ error: '이미 사용 중인 학원 키입니다.' }, { status: 409 });
    }
  }

  const updated = await prisma.academy.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(loginKey !== undefined && { loginKey: loginKey || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(address !== undefined && { address: address || null }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(updated);
}
