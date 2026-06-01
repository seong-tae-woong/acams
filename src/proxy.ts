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
  '/intro',             // 마케팅 랜딩 페이지 (공개)
  '/api/intro',         // 마케팅 상담 신청 API (공개)
  '/academy',           // 학원 공개 소개 페이지
  '/api/academy',       // 학원 공개 API
  '/api/gallery-proxy', // Private Blob 이미지 프록시
  '/api/kiosk/session', // 키오스크 QR 토큰 발급 (인증 불필요)
  '/api/kiosk/recent',  // 키오스크 최근 체크인 조회 (인증 불필요)
  '/api/webhooks/toss', // 토스 결제 웹훅 — 쿠키 없이 호출됨, 핸들러가 HMAC 서명 자체 검증
  '/api/cron',          // Vercel Cron — 쿠키 없이 호출됨, 핸들러가 CRON_SECRET Bearer 검증
];

// tablet 역할이 접근 가능한 경로
const TABLET_ALLOWED = ['/ingang-tablet', '/api/ingang-tablet'];

// 강사(role==='teacher') 메뉴 권한 enforce — director/super_admin은 제외, admin 권한이면 전체 통과
// permKey 'admin'은 admin 권한 보유자만 접근(예: /settings) — admin은 아래 분기에서 이미 전체 통과하므로 사실상 차단
type PermKey =
  | 'manageStudents' | 'manageClasses' | 'manageAttendance' | 'manageGrades'
  | 'manageFinance' | 'manageNotifications' | 'viewReports' | 'admin';

// 경로 접두사 → 필요 권한. 더 구체적인 경로가 먼저 와야 함(앞에서부터 매칭)
const TEACHER_PAGE_RULES: Array<[string, PermKey]> = [
  ['/students/lessons', 'manageGrades'],
  ['/students/attendance', 'manageAttendance'],
  ['/students/grades', 'manageGrades'],
  ['/students', 'manageStudents'],
  ['/classes/attendance', 'manageAttendance'],
  ['/classes/lessons', 'manageGrades'],
  ['/classes/makeup', 'manageClasses'],
  ['/classes', 'manageClasses'],
  ['/finance', 'manageFinance'],
  ['/communication', 'manageNotifications'],
  ['/analytics', 'viewReports'],
  ['/settings', 'admin'],
];

const TEACHER_API_RULES: Array<[string, PermKey]> = [
  ['/api/students', 'manageStudents'],
  ['/api/attendance', 'manageAttendance'],
  ['/api/exam-categories', 'manageGrades'],
  ['/api/exams', 'manageGrades'],
  ['/api/grades', 'manageGrades'],
  ['/api/lessons', 'manageGrades'],
  ['/api/assignments', 'manageGrades'],
  ['/api/makeup', 'manageClasses'],
  ['/api/teachers', 'manageClasses'],
  ['/api/classes', 'manageClasses'],
  ['/api/finance', 'manageFinance'],
  ['/api/communication', 'manageNotifications'],
  ['/api/report-templates', 'viewReports'],
  ['/api/reports', 'viewReports'],
  ['/api/analytics', 'viewReports'],
  ['/api/settings', 'admin'],
];

function matchPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

// 반·학생 목록은 거의 모든 페이지(출결·수업·리포트 등)의 기초 조회 의존성 —
// GET(읽기)은 모든 강사 허용, 생성/수정/삭제는 위 RULES의 권한대로 차단
const SHARED_READ_API = ['/api/classes', '/api/students'];
function isSharedRead(pathname: string, method: string) {
  return method === 'GET' && SHARED_READ_API.some((p) => matchPrefix(pathname, p));
}

// 권한 없는 강사가 접근 시 리다이렉트할 첫 허용 페이지 (없으면 항상 접근 가능한 /calendar)
function firstAllowedPage(perms: Partial<Record<PermKey, boolean>>): string {
  if (perms.manageStudents) return '/students';
  if (perms.manageClasses) return '/classes';
  if (perms.manageAttendance) return '/classes/attendance';
  if (perms.manageGrades) return '/classes/lessons';
  if (perms.manageFinance) return '/finance/billing';
  if (perms.manageNotifications) return '/communication/notifications';
  if (perms.viewReports) return '/analytics';
  return '/calendar';
}

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
  const isApi = pathname.startsWith('/api/');

  if (!token) {
    // API 요청은 401 JSON으로 응답 — fetch가 로그인 HTML을 받아 깨지는 것 방지
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', req.url));
  }

  let payload: { userId?: string; role?: string; academyId?: string | null; name?: string; tokenVersion?: number; mustChangePassword?: boolean; permissions?: Partial<Record<PermKey, boolean>> };
  try {
    const { payload: p } = await jwtVerify(token, SECRET);
    payload = p as typeof payload;
  } catch {
    // 토큰 만료 또는 무효 — 잘못된 쿠키 제거
    const res = isApi
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url));
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

  // tablet 계정: TABLET_ALLOWED 경로만 허용, 나머지는 /ingang-tablet으로
  if (role === 'tablet') {
    const allowed = TABLET_ALLOWED.some((p) => pathname.startsWith(p));
    if (!allowed) return NextResponse.redirect(new URL('/ingang-tablet', req.url));
  }

  // 비-tablet 계정이 /ingang-tablet 접근 시 → /login
  if (pathname.startsWith('/ingang-tablet') && role !== 'tablet') {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  // 비-tablet 계정이 /api/ingang-tablet 접근 시 → 401
  // 단, /api/ingang-tablet/daily-code는 teacher·director도 접근 가능 (태블릿 코드 조회/재발급)
  if (pathname.startsWith('/api/ingang-tablet') && role !== 'tablet') {
    const isAdminAllowed =
      pathname.startsWith('/api/ingang-tablet/daily-code') &&
      (role === 'teacher' || role === 'director');
    if (!isAdminAllowed) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

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

  // 강사 메뉴 권한 enforce — director/super_admin은 전체 접근, teacher만 권한별 제어
  // admin 권한 강사는 전체 통과. /calendar·/ingang 등 매핑 없는 경로는 기본 허용.
  if (role === 'teacher') {
    const perms = payload.permissions ?? {};
    if (!perms.admin) {
      const rules = isApi ? TEACHER_API_RULES : TEACHER_PAGE_RULES;
      const matched = rules.find(([prefix]) => matchPrefix(pathname, prefix));
      if (matched && !perms[matched[1]] && !(isApi && isSharedRead(pathname, req.method))) {
        if (isApi) {
          return new NextResponse(JSON.stringify({ error: '접근 권한이 없습니다.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return NextResponse.redirect(new URL(firstAllowedPage(perms), req.url));
      }
    }
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
