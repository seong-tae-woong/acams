import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/validateSession';

export interface AuthContext {
  academyId: string;
  userId: string;
  role: string;
}

/**
 * 인증된 API 요청을 검증한다.
 * - x-academy-id 헤더 확인 (멀티테넌트 — proxy가 주입)
 * - validateSession: 계정 활성 상태 + 토큰 버전 확인
 *   (계정 비활성화·비밀번호 초기화 시 기존 토큰을 즉시 무효화)
 *
 * @returns 성공 시 AuthContext, 실패 시 즉시 반환할 에러 NextResponse
 *
 * 사용 예:
 *   const auth = await requireAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const { academyId } = auth;
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionError = await validateSession(req);
  if (sessionError) return sessionError;

  return {
    academyId,
    userId: req.headers.get('x-user-id') ?? '',
    role: req.headers.get('x-user-role') ?? '',
  };
}
