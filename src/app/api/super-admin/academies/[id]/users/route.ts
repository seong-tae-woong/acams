import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { validatePassword } from '@/lib/auth/passwordValidator';

function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/super-admin/academies/[id]/users — 원장 계정 추가
// body: { name, email, password, role?: 'director' | 'teacher' }
export async function POST(req: NextRequest, ctx: RouteContext) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: academyId } = await ctx.params;

  const academy = await prisma.academy.findUnique({ where: { id: academyId } });
  if (!academy) {
    return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });
  }

  const body = await req.json();
  const { name, email, password, role } = body as {
    name?: string;
    email?: string;
    password?: string;
    role?: 'director' | 'teacher';
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: '이름, 이메일, 비밀번호는 필수입니다.' }, { status: 400 });
  }
  const pwValidation = validatePassword(password);
  if (!pwValidation.valid) {
    return NextResponse.json({ error: pwValidation.error }, { status: 400 });
  }

  const targetRole = role === 'teacher' ? 'teacher' : 'director';
  const normalizedEmail = email.trim().toLowerCase();

  const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingEmail) {
    return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      role: targetRole,
      academyId,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(created, { status: 201 });
}
