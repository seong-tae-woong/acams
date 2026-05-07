import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { isRateLimited, getRemainingSeconds } from '@/lib/auth/rateLimit';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// 글로벌 IP 제한 — 정상 사용자(분당 ~50회) 대비 충분히 여유 있는 임계값
const GLOBAL_API_LIMIT = 600;          // 분당 600회 (초당 10회 평균)
const GLOBAL_API_WINDOW_MS = 60 * 1000;

// 인증 없이 접근 가능한 경로
const PUBLIC_PATHS = [
  '/login',
  '/change-password',
  '/api/auth/login',
  '/api/auth/change-password',
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

  // 글로벌 IP rate limit — /api/* 모든 요청에 적용 (정적 자산은 matcher에서 제외됨)
  if (pathname.startsWith('/api/')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (isRateLimited(`global:${ip}`, GLOBAL_API_LIMIT, GLOBAL_API_WINDOW_MS)) {
      const secs = getRemainingSeconds(`global:${ip}`);
      return new NextResponse(
        JSON.stringify({ error: `요청이 너무 많습니다. ${secs}초 후 다시 시도해주세요.` }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(secs) } },
      );
    }
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get('acams_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  let payload: { userId?: string; role?: string; academyId?: string | null; name?: string; tokenVersion?: number; mustChangePassword?: boolean };
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

  // 비밀번호 강제 변경 — /change-password 외 모든 경로 차단
  if (payload.mustChangePassword && !pathname.startsWith('/change-password')) {
    return NextResponse.redirect(new URL('/change-password', req.url));
  }

  // 역할별 접근 제어
  if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname.startsWith('/mobile') && role !== 'parent' && role !== 'student') {
    // 관리자가 /mobile 접근 시 → /students로
    return NextResponse.redirect(new URL('/students', req.url));
  }

  const isAdminPage =
    pathname.startsWith('/students') ||
    pathname.startsWith('/classes') ||
    pathname.startsWith('/finance') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/communication') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/settings');

  if (isAdminPage && role === 'super_admin') {
    return NextResponse.redirect(new URL('/super-admin', req.url));
  }

  // 학부모/학생이 관리자 영역 또는 인강 영역 직접 접근 시 → /mobile
  if ((isAdminPage || pathname.startsWith('/ingang')) && (role === 'parent' || role === 'student')) {
    return NextResponse.redirect(new URL('/mobile', req.url));
  }

  // 하위 컴포넌트에 유저 정보 전달 (헤더 주입)
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', userId);
  requestHeaders.set('x-user-role', role);
  requestHeaders.set('x-academy-id', academyId);
  requestHeaders.set('x-user-name', encodeURIComponent(payload.name ?? ''));
  requestHeaders.set('x-token-version', String(payload.tokenVersion ?? 0));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
