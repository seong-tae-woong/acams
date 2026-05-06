import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';
import { validatePassword } from '@/lib/auth/passwordValidator';
import { writeAuditLog } from '@/lib/auth/auditLog';
import { isRateLimited, getRemainingSeconds } from '@/lib/auth/rateLimit';

// POST /api/auth/change-password
// 공개 경로 — JWT 쿠키에서 직접 사용자 확인
export async function POST(req: NextRequest) {
  // IP 기반 rate limiting (현재 비밀번호 brute-force 방지)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(`change-pw:${ip}`, 10, 15 * 60 * 1000)) {
    const secs = getRemainingSeconds(`change-pw:${ip}`);
    return NextResponse.json(
      { error: `너무 많은 시도입니다. ${Math.ceil(secs / 60)}분 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('acams_token')?.value;

  if (!token) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    return NextResponse.json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 });
  }

  const { userId, role, academyId, name, tokenVersion } = payload;

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  // 비밀번호 복잡도 검증
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }

  // tokenVersion 일치 확인 (세션 유효성)
  if (user.tokenVersion !== tokenVersion) {
    return NextResponse.json({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 });
  }

  // 현재 비밀번호 확인
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
  }

  // 최근 3개 비밀번호 재사용 방지
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  for (const h of history) {
    if (await bcrypt.compare(newPassword, h.passwordHash)) {
      return NextResponse.json(
        { error: '최근 3개 비밀번호와 다른 비밀번호를 사용해야 합니다.' },
        { status: 400 },
      );
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  // 트랜잭션: 업데이트 후 실제 DB tokenVersion을 읽어 JWT 발급
  const updated = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    });
    await tx.passwordHistory.create({ data: { userId, passwordHash: newHash } });
    const old = await tx.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (old.length > 3) {
      await tx.passwordHistory.deleteMany({
        where: { id: { in: old.slice(0, old.length - 3).map((h) => h.id) } },
      });
    }
    return updatedUser;
  });

  // 새 JWT 발급 — DB 실제 tokenVersion 사용
  const newToken = signToken({
    userId,
    role,
    academyId,
    name,
    tokenVersion: updated.tokenVersion,
    mustChangePassword: false,
  });
  await setAuthCookie(newToken);

  await writeAuditLog({ action: 'PASSWORD_CHANGE', userId, role, ipAddress: ip });

  // 역할별 리다이렉트 경로 반환
  let redirectTo = '/students';
  if (role === 'super_admin') redirectTo = '/super-admin';
  else if (role === 'parent' || role === 'student') redirectTo = '/mobile';

  return NextResponse.json({ ok: true, redirectTo });
}
