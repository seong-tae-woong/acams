import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { sendSms } from '@/lib/sms/solapi';
import { writeAuditLog } from '@/lib/auth/auditLog';
import { validateSession } from '@/lib/auth/validateSession';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[randomInt(chars.length)]).join('');
}

// POST /api/students/[id]/reset-password
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  const role = req.headers.get('x-user-role');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장만 비밀번호를 초기화할 수 있습니다.' }, { status: 403 });
  }

  const sessionError = await validateSession(req);
  if (sessionError) return sessionError;

  const { id } = await ctx.params;
  const { target } = await req.json(); // 'student' | 'parent'

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: true,
        parentLinks: { include: { parent: { include: { user: true } } } },
      },
    });

    if (!student || student.academyId !== academyId) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    if (target === 'parent') {
      const parentUser = student.parentLinks[0]?.parent?.user;
      const parentPhone = student.parentLinks[0]?.parent?.phone;
      if (!parentUser) {
        return NextResponse.json({ error: '학부모 계정이 없습니다.' }, { status: 404 });
      }
      await prisma.user.update({
        where: { id: parentUser.id },
        data: { passwordHash, tokenVersion: { increment: 1 }, mustChangePassword: true },
      });
      if (parentPhone) {
        await sendSms(parentPhone, `[AcaMS] 비밀번호 초기화\nID: ${parentUser.loginId}\n임시PW: ${tempPassword}`);
      }
      await writeAuditLog({
        action: 'PASSWORD_RESET',
        userId: req.headers.get('x-user-id') ?? undefined,
        role: role ?? undefined,
        academyId: academyId ?? undefined,
        target: parentUser.id,
      });
      return NextResponse.json({ loginId: parentUser.loginId });
    } else {
      // student (default)
      if (!student.user) {
        return NextResponse.json({ error: '학생 계정이 없습니다.' }, { status: 404 });
      }
      await prisma.user.update({
        where: { id: student.user.id },
        data: { passwordHash, tokenVersion: { increment: 1 }, mustChangePassword: true },
      });
      if (student.phone) {
        await sendSms(student.phone, `[AcaMS] 비밀번호 초기화\nID: ${student.user.loginId}\n임시PW: ${tempPassword}`);
      }
      await writeAuditLog({
        action: 'PASSWORD_RESET',
        userId: req.headers.get('x-user-id') ?? undefined,
        role: role ?? undefined,
        academyId: academyId ?? undefined,
        target: student.user.id,
      });
      return NextResponse.json({ loginId: student.user.loginId });
    }
  } catch (err) {
    console.error('[POST /api/students/[id]/reset-password]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
