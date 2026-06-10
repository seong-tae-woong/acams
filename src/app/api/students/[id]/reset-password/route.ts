import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { sendSms } from '@/lib/sms/solapi';
import { writeAuditLog } from '@/lib/auth/auditLog';
import { requireAuth } from '@/lib/auth/requireAuth';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[randomInt(chars.length)]).join('');
}

// POST /api/students/[id]/reset-password
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  // 학생·학부모 비밀번호 초기화: 원장·슈퍼어드민 + 강사(학생관리 권한).
  // 강사의 manageStudents 권한은 proxy(edge)가 /api/students 하위 POST를 이미 차단하므로 여기선 역할만 확인.
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

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

    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { smsEnabled: true },
    });
    const smsEnabled = academy?.smsEnabled ?? true;

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
      if (smsEnabled && parentPhone) {
        await sendSms(parentPhone, `[학원로그] 비밀번호 초기화\nID: ${parentUser.loginId}\n임시PW: ${tempPassword}`);
      }
      await writeAuditLog({
        action: 'PASSWORD_RESET',
        userId: req.headers.get('x-user-id') ?? undefined,
        role: role ?? undefined,
        academyId: academyId ?? undefined,
        target: parentUser.id,
      });
      // smsEnabled=true: 임시 비밀번호는 SMS로만 전달 — 평문을 클라이언트로 보내지 않음(화면 미노출)
      return NextResponse.json({ loginId: parentUser.loginId, tempPassword: smsEnabled ? null : tempPassword, smsEnabled });
    } else {
      // student (default)
      if (!student.user) {
        return NextResponse.json({ error: '학생 계정이 없습니다.' }, { status: 404 });
      }
      await prisma.user.update({
        where: { id: student.user.id },
        data: { passwordHash, tokenVersion: { increment: 1 }, mustChangePassword: true },
      });
      // 학생 phone 있으면 학생에게, 학부모 phone 있으면 학부모에게도 발송
      if (smsEnabled) {
        const smsPromises: Promise<void>[] = [];
        if (student.phone) {
          smsPromises.push(
            sendSms(student.phone, `[학원로그] 비밀번호 초기화\nID: ${student.user.loginId}\n임시PW: ${tempPassword}`),
          );
        }
        const parentPhoneForStudentReset = student.parentLinks[0]?.parent?.phone;
        if (parentPhoneForStudentReset) {
          smsPromises.push(
            sendSms(
              parentPhoneForStudentReset,
              `[학원로그] 자녀(${student.name}) 학생 계정 비밀번호 초기화\nID: ${student.user.loginId}\n임시PW: ${tempPassword}`,
            ),
          );
        }
        await Promise.all(smsPromises);
      }
      await writeAuditLog({
        action: 'PASSWORD_RESET',
        userId: req.headers.get('x-user-id') ?? undefined,
        role: role ?? undefined,
        academyId: academyId ?? undefined,
        target: student.user.id,
      });
      // smsEnabled=true: 임시 비밀번호는 SMS로만 전달 — 평문을 클라이언트로 보내지 않음(화면 미노출)
      return NextResponse.json({ loginId: student.user.loginId, tempPassword: smsEnabled ? null : tempPassword, smsEnabled });
    }
  } catch (err) {
    console.error('[POST /api/students/[id]/reset-password]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
