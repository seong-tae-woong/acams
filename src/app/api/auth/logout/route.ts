import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth/cookies';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  // 로그아웃 시 tokenVersion을 증가시켜 기존 토큰을 즉시 무효화
  // (쿠키를 저장해 둔 공격자가 이후 API를 직접 호출하는 경우를 차단)
  const userId = req.headers.get('x-user-id');
  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }).catch(() => {
      // 로그아웃은 DB 오류와 무관하게 쿠키를 삭제해야 함
    });
  }

  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
