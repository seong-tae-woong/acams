import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { signToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const rawIdentifier = email.trim();
    const lowerIdentifier = rawIdentifier.toLowerCase();

    // 이메일로 먼저 조회 (원장·강사·슈퍼어드민)
    // 없으면 loginId로 조회 (학생=출석번호, 학부모=전화번호)
    let user = await prisma.user.findUnique({
      where: { email: lowerIdentifier },
      include: { academy: true },
    });

    if (!user) {
      // loginId 조회: 대소문자 무시, 학부모 전화번호(010-0000-0000/01000000000) 형식 모두 허용
      const normalized = rawIdentifier.replace(/-/g, ''); // 하이픈 제거
      const withDashes = rawIdentifier.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3'); // 하이픈 추가

      user = await prisma.user.findFirst({
        where: {
          isActive: true,
          OR: [
            { loginId: { equals: rawIdentifier, mode: 'insensitive' } },
            { loginId: { equals: normalized, mode: 'insensitive' } },
            { loginId: { equals: withDashes, mode: 'insensitive' } },
          ],
        },
        include: { academy: true },
      });
    }

    if (!user || !user.isActive) {
      return NextResponse.json({ error: '아이디를 확인하세요.' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: '비밀번호를 확인하세요.' }, { status: 401 });
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      academyId: user.academyId,
      name: user.name,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        academyId: user.academyId,
        academyName: user.academy?.name ?? null,
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
