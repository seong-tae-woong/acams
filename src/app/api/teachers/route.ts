import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { TeacherPermissions } from '@/lib/types/teacher';
import { DEFAULT_PERMISSIONS } from '@/lib/types/teacher';
import { sendSms } from '@/lib/sms/solapi';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[randomInt(chars.length)]).join('');
}

const TEACHER_INCLUDE = {
  classes: { select: { classId: true } },
} as const;

function mapTeacher(t: {
  id: string; name: string; subject: string; phone: string;
  email: string; avatarColor: string; isActive: boolean;
  permissions: unknown;
  classes: { classId: string }[];
}) {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    phone: t.phone,
    email: t.email,
    avatarColor: t.avatarColor,
    isActive: t.isActive,
    permissions: (t.permissions as TeacherPermissions) ?? DEFAULT_PERMISSIONS,
    classes: t.classes.map((c) => c.classId),
  };
}

// GET /api/teachers
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const teachers = await prisma.teacher.findMany({
      where: { academyId },
      include: TEACHER_INCLUDE,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(teachers.map(mapTeacher));
  } catch (err) {
    console.error('[GET /api/teachers]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/teachers
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, subject, phone, email, avatarColor, permissions } = body;

    if (!name) return NextResponse.json({ error: '이름은 필수입니다.' }, { status: 400 });
    if (!email) return NextResponse.json({ error: '이메일은 필수입니다.' }, { status: 400 });

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });
    }

    const tempPassword = generateTempPassword();

    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(tempPassword, 12),
          name,
          role: 'teacher',
          academyId,
        },
      });

      return tx.teacher.create({
        data: {
          academyId,
          name,
          subject: subject ?? '',
          phone: phone ?? '',
          email: email ?? '',
          avatarColor: avatarColor ?? '#4A90D9',
          permissions: permissions ?? DEFAULT_PERMISSIONS,
          userId: user.id,
        },
        include: TEACHER_INCLUDE,
      });
    });

    if (phone) {
      await sendSms(phone, `[AcaMS] 강사 계정\nID: ${email}\n임시PW: ${tempPassword}`);
    }

    return NextResponse.json(mapTeacher(teacher), { status: 201 });
  } catch (err) {
    console.error('[POST /api/teachers]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
