import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { validatePassword } from '@/lib/auth/passwordValidator';
import { writeAuditLog } from '@/lib/auth/auditLog';

export async function PATCH(req: NextRequest) {
  if (req.headers.get('x-user-role') !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (!user) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }

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
      return NextResponse.json({ error: '최근 3개 비밀번호와 다른 비밀번호를 사용해야 합니다.' }, { status: 400 });
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
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
  });

  await writeAuditLog({ action: 'PASSWORD_CHANGE', userId, role: 'super_admin' });

  return NextResponse.json({ ok: true });
}
