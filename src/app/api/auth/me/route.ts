import { NextResponse } from 'next/server';
import { getAuthToken, COOKIE_NAME } from '@/lib/auth/cookies';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';

// 토큰이 무효일 때 401과 함께 쿠키를 제거 — edge proxy(tokenVersion 미검증)가
// 죽은 토큰을 계속 통과시켜 메뉴가 깨진 채 남는 것을 막는다.
function unauthorized(clearCookie = false) {
  const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (clearCookie) res.cookies.delete(COOKIE_NAME);
  return res;
}

export async function GET() {
  try {
    const token = await getAuthToken();
    if (!token) {
      return unauthorized();
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return unauthorized(true);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { academy: true },
    });

    if (!user || !user.isActive) {
      return unauthorized(true);
    }

    // tokenVersion 불일치 → 권한/비밀번호 변경·로그아웃으로 무효화된 토큰
    if (user.tokenVersion !== payload.tokenVersion) {
      return unauthorized(true);
    }

    let permissions: unknown;
    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        select: { permissions: true },
      });
      permissions = teacher?.permissions ?? null;
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      academyId: user.academyId,
      academyName: user.academy?.name ?? null,
      ...(user.role === 'teacher' && { permissions }),
    });
  } catch (err) {
    console.error('[me]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
