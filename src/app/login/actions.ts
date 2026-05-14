'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { signToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';
import { isRateLimited, getRemainingSeconds } from '@/lib/auth/rateLimit';
import { writeAuditLog } from '@/lib/auth/auditLog';

export type LoginActionState = { error: string } | null;

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30분
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15분
const RATE_LIMIT_MAX = 20; // IP당 15분에 최대 20회

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const rawIdentifier = ((formData.get('email') as string) ?? '').trim();
  const password = (formData.get('password') as string) ?? '';

  if (!rawIdentifier || !password) {
    return { error: '아이디와 비밀번호를 입력해주세요.' };
  }

  // IP 기반 속도 제한
  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(`login:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    const secs = getRemainingSeconds(`login:${ip}`);
    return { error: `너무 많은 시도입니다. ${Math.ceil(secs / 60)}분 후 다시 시도해주세요.` };
  }

  let redirectTo = '/calendar';

  try {
    const lowerIdentifier = rawIdentifier.toLowerCase();

    // 이메일로 먼저 조회 (원장·강사·슈퍼어드민)
    let user = await prisma.user.findUnique({
      where: { email: lowerIdentifier },
      include: { academy: true },
    });

    if (!user) {
      const normalized = rawIdentifier.replace(/-/g, '');
      const withDashes = rawIdentifier.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
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
      await writeAuditLog({ action: 'LOGIN_FAILURE', detail: { identifier: rawIdentifier }, ipAddress: ip });
      return { error: '아이디 또는 비밀번호가 일치하지 않습니다.' };
    }

    // 계정 잠금 확인
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await writeAuditLog({ action: 'LOGIN_LOCKED', userId: user.id, role: user.role, academyId: user.academyId ?? undefined, ipAddress: ip });
      return { error: `비밀번호 오류가 많아 계정이 잠겼습니다. ${mins}분 후 다시 시도해주세요.` };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const attempts = user.loginAttempts + 1;
      const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts,
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) } : {}),
        },
      });
      await writeAuditLog({ action: 'LOGIN_FAILURE', userId: user.id, role: user.role, academyId: user.academyId ?? undefined, detail: { attempts }, ipAddress: ip });
      if (shouldLock) {
        return { error: `비밀번호를 ${MAX_LOGIN_ATTEMPTS}회 틀려 계정이 30분 잠겼습니다.` };
      }
      return { error: `아이디 또는 비밀번호가 일치하지 않습니다. (${attempts}/${MAX_LOGIN_ATTEMPTS}회)` };
    }

    // 로그인 성공 — 잠금 초기화
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    await writeAuditLog({ action: 'LOGIN_SUCCESS', userId: user.id, role: user.role, academyId: user.academyId ?? undefined, ipAddress: ip });

    // 비밀번호 90일 만료 체크 (원장·슈퍼어드민)
    const ADMIN_ROLES = ['super_admin', 'director'];
    const daysSinceChange = (Date.now() - user.passwordChangedAt.getTime()) / 86400000;
    const isPasswordExpired = ADMIN_ROLES.includes(user.role) && daysSinceChange > 90;

    const token = signToken({
      userId: user.id,
      role: user.role,
      academyId: user.academyId,
      name: user.name,
      tokenVersion: user.tokenVersion,
      mustChangePassword: user.mustChangePassword || isPasswordExpired,
    });

    await setAuthCookie(token);

    if (user.mustChangePassword || isPasswordExpired) {
      redirectTo = '/change-password';
    } else if (user.role === 'super_admin') {
      redirectTo = '/super-admin';
    } else if (user.role === 'parent' || user.role === 'student') {
      redirectTo = '/mobile';
    } else if (user.role === 'tablet') {
      redirectTo = '/ingang-tablet';
    }
  } catch (err) {
    console.error('[loginAction]', err instanceof Error ? err.message : String(err));
    return { error: '서버 오류가 발생했습니다.' };
  }

  redirect(redirectTo);
}
