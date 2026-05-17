import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

function onlyDirector(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  return role === 'director' || role === 'super_admin';
}

// GET /api/settings/tablets — 학원 태블릿 계정 목록
export async function GET(req: NextRequest) {
  if (!onlyDirector(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const tablets = await prisma.user.findMany({
      where: { academyId, role: 'tablet' },
      select: { id: true, name: true, loginId: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(tablets);
  } catch (err) {
    console.error('[GET /api/settings/tablets]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/settings/tablets — 태블릿 계정 생성
export async function POST(req: NextRequest) {
  if (!onlyDirector(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const body = await req.json();
    const { name, password } = body ?? {};

    if (!name?.trim() || !password?.trim()) {
      return NextResponse.json({ error: '별칭과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { slug: true },
    });
    if (!academy) return NextResponse.json({ error: '학원 정보를 찾을 수 없습니다.' }, { status: 404 });

    const count = await prisma.user.count({ where: { academyId, role: 'tablet' } });
    const loginId = `tablet_${academy.slug}_${String(count + 1).padStart(2, '0')}`;

    const existing = await prisma.user.findFirst({ where: { academyId, loginId } });
    if (existing) {
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password.trim(), 10);
    const tablet = await prisma.user.create({
      data: {
        academyId,
        loginId,
        passwordHash,
        name: name.trim(),
        role: 'tablet',
        mustChangePassword: false,
      },
      select: { id: true, name: true, loginId: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ ...tablet, password: password.trim() }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/settings/tablets]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
