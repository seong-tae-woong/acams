import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * 요청 헤더의 tokenVersion과 DB의 tokenVersion을 비교해 세션 유효성 검사.
 * 계정 비활성화 또는 비밀번호 초기화 시 기존 토큰을 즉시 무효화한다.
 *
 * @returns null이면 유효, NextResponse면 즉시 반환할 에러 응답
 */
export async function validateSession(req: NextRequest): Promise<NextResponse | null> {
  const userId = req.headers.get('x-user-id');
  const tokenVersionHeader = req.headers.get('x-token-version');

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, tokenVersion: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 401 });
  }

  const headerVersion = parseInt(tokenVersionHeader ?? '0', 10);
  if (user.tokenVersion !== headerVersion) {
    return NextResponse.json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 });
  }

  return null;
}
