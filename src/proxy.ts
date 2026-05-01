import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// 인증 없이 접근 가능한 경로
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/kiosk',
  '/_next',
  '/favicon.ico',
  '/sw.js',
  '/manifest.json',
  '/icon-',
  '/academy',           // 학원 공개 소개 페이지
  '/api/academy',       // 학원 공개 API
  '/api/gallery-proxy', // Private Blob 이미지 프록시
  '/api/kiosk/session', // 키오스크 QR 토큰 발급 (인증 불필요)
  '/api/kiosk/recent',  // 키오스크 최근 체크인 조회 (인증 불필요)
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('acams_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  let payload: { userId?: string; role?: string; academyId?: string | null; name?: string };
  try {
    const { payload: p } = await jwtVerify(token, SECRET);
    payload = p as typeof payload;
  } catch {
    // 토큰 만료 또는 무효
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('acams_token');
    return res;
  }

  const role = payload.role ?? '';
  const academyId = payload.academyId ?? '';
  const userId = payload.userId ?? '';

  // 역할별 접근 제어
  if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname.startsWith('/mobile') && role !== 'parent' && role !== 'student') {
    // 관리자가 /mobile 접근 시 → /students로
    return NextResponse.redirect(new URL('/students', req.url));
  }

  if (
    (pathname.startsWith('/students') ||
      pathname.startsWith('/classes') ||
      pathname.startsWith('/finance') ||
      pathname.startsWith('/calendar') ||
      pathname.startsWith('/communication') ||
      pathname.startsWith('/analytics') ||
      pathname.startsWith('/settings')) &&
    role === 'super_admin'
  ) {
    return NextResponse.redirect(new URL('/super-admin', req.url));
  }

  // 하위 컴포넌트에 유저 정보 전달 (헤더 주입)
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', userId);
  requestHeaders.set('x-user-role', role);
  requestHeaders.set('x-academy-id', academyId);
  requestHeaders.set('x-user-name', encodeURIComponent(payload.name ?? ''));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
