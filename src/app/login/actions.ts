'use server';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { signToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';

export type LoginActionState = { error: string } | null;

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const rawIdentifier = ((formData.get('email') as string) ?? '').trim();
  const password = (formData.get('password') as string) ?? '';

  if (!rawIdentifier || !password) {
    return { error: '아이디와 비밀번호를 입력해주세요.' };
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
      // loginId 조회: 하이픈 유무 모두 허용
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
      return { error: '아이디를 확인하세요.' };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return { error: '비밀번호를 확인하세요.' };
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      academyId: user.academyId,
      name: user.name,
    });

    await setAuthCookie(token);

    if (user.role === 'super_admin') redirectTo = '/super-admin';
    else if (user.role === 'parent' || user.role === 'student') redirectTo = '/mobile';
  } catch (err) {
    console.error('[loginAction]', err);
    return { error: '서버 오류가 발생했습니다.' };
  }

  // redirect()는 try-catch 밖에서 호출 (내부적으로 throw하기 때문)
  redirect(redirectTo);
}
