import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

// 슈퍼어드민 전용 — proxy.ts에서 role 체크 후 x-user-role 헤더 주입됨
function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

// GET /api/super-admin/academies — 전체 학원 목록
export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const academies = await prisma.academy.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, students: true } },
    },
  });

  return NextResponse.json(academies);
}

// POST /api/super-admin/academies — 학원 + 원장 계정 동시 생성
export async function POST(req: NextRequest) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { academyName, slug, loginKey, phone, directorName, directorEmail, directorPassword } =
      await req.json();

    if (!academyName || !slug || !directorName || !directorEmail || !directorPassword) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    if (directorPassword.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }

    // loginKey 유효성 검사: 3글자 영문 대문자
    if (loginKey) {
      if (!/^[A-Z]{3}$/.test(loginKey)) {
        return NextResponse.json({ error: '학원 키는 영문 대문자 3글자여야 합니다. (예: SGR)' }, { status: 400 });
      }
      const existingKey = await prisma.academy.findUnique({ where: { loginKey } });
      if (existingKey) {
        return NextResponse.json({ error: '이미 사용 중인 학원 키입니다.' }, { status: 409 });
      }
    }

    // 학원명 중복 확인
    const existingName = await prisma.academy.findFirst({ where: { name: academyName } });
    if (existingName) {
      return NextResponse.json({ error: '이미 사용 중인 학원명입니다.' }, { status: 409 });
    }

    // 슬러그 중복 확인
    const existing = await prisma.academy.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: '이미 사용 중인 슬러그입니다.' }, { status: 409 });
    }

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({ where: { email: directorEmail.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(directorPassword, 12);

    // 트랜잭션: Academy + director User 동시 생성
    const result = await prisma.$transaction(async (tx) => {
      const academy = await tx.academy.create({
        data: { name: academyName, slug, loginKey: loginKey || null, phone: phone || null },
      });

      const director = await tx.user.create({
        data: {
          email: directorEmail.toLowerCase(),
          passwordHash,
          name: directorName,
          role: 'director',
          academyId: academy.id,
        },
      });

      return { academy, director };
    });

    return NextResponse.json({
      academyId: result.academy.id,
      directorId: result.director.id,
    }, { status: 201 });
  } catch (err) {
    console.error('[super-admin/academies POST]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
