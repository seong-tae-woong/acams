import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { StudentStatus as PrismaStatus } from '@/generated/prisma/client';
import { sendSms } from '@/lib/sms/solapi';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[randomInt(chars.length)]).join('');
}

// UI 문자열 ↔ Prisma enum 변환
const STATUS_TO_PRISMA: Record<string, PrismaStatus> = {
  '재원': PrismaStatus.ACTIVE,
  '휴원': PrismaStatus.ON_LEAVE,
  '퇴원': PrismaStatus.WITHDRAWN,
  '대기': PrismaStatus.WAITING,
};

const STATUS_TO_UI: Record<PrismaStatus, string> = {
  [PrismaStatus.ACTIVE]: '재원',
  [PrismaStatus.ON_LEAVE]: '휴원',
  [PrismaStatus.WITHDRAWN]: '퇴원',
  [PrismaStatus.WAITING]: '대기',
};

function mapStudent(s: {
  id: string; name: string; school: string; grade: number;
  phone: string | null; status: PrismaStatus; enrollDate: Date;
  memo: string; avatarColor: string; attendanceNumber: string;
  qrCode: string; birthDate: Date | null;
  parentLinks: { parent: { name: string; phone: string } }[];
  classEnrollments: { classId: string; isActive: boolean }[];
  siblingLinks: { studentBId: string }[];
  siblingOf: { studentAId: string }[];
}) {
  return {
    id: s.id,
    name: s.name,
    school: s.school,
    grade: s.grade,
    phone: s.phone ?? '',
    parentName: s.parentLinks[0]?.parent.name ?? '',
    parentPhone: s.parentLinks[0]?.parent.phone ?? '',
    status: STATUS_TO_UI[s.status],
    enrollDate: s.enrollDate.toISOString().slice(0, 10),
    classes: s.classEnrollments.filter((e) => e.isActive).map((e) => e.classId),
    siblingIds: [
      ...s.siblingLinks.map((sl) => sl.studentBId),
      ...s.siblingOf.map((sl) => sl.studentAId),
    ],
    memo: s.memo,
    avatarColor: s.avatarColor,
    attendanceNumber: s.attendanceNumber,
    qrCode: s.qrCode,
    birthDate: s.birthDate?.toISOString().slice(0, 10) ?? undefined,
  };
}

const STUDENT_INCLUDE = {
  parentLinks: { include: { parent: { select: { name: true, phone: true } } } },
  classEnrollments: { select: { classId: true, isActive: true } },
  siblingLinks: { select: { studentBId: true } },
  siblingOf: { select: { studentAId: true } },
} as const;

// GET /api/students?status=&q=
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusStr = searchParams.get('status');
  const q = searchParams.get('q') ?? '';

  try {
    const students = await prisma.student.findMany({
      where: {
        academyId,
        ...(statusStr && STATUS_TO_PRISMA[statusStr]
          ? { status: STATUS_TO_PRISMA[statusStr] }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { school: { contains: q } },
              ],
            }
          : {}),
      },
      include: STUDENT_INCLUDE,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(students.map(mapStudent));
  } catch (err) {
    console.error('[GET /api/students]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/students — 학생 등록
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name, school, grade, phone, parentName, parentPhone,
      status, enrollDate, memo, avatarColor, attendanceNumber, birthDate,
    } = body;

    if (!name) return NextResponse.json({ error: '이름은 필수입니다.' }, { status: 400 });

    // 출석번호 중복 체크
    if (attendanceNumber) {
      const existing = await prisma.student.findUnique({
        where: { academyId_attendanceNumber: { academyId, attendanceNumber } },
      });
      if (existing) {
        return NextResponse.json({ error: `출석번호 ${attendanceNumber}은(는) 이미 사용 중입니다.` }, { status: 409 });
      }
    }

    // 학원 loginKey 조회 — 학생 loginId = loginKey + attendanceNumber
    const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { loginKey: true } });
    const studentLoginId = academy?.loginKey && attendanceNumber
      ? `${academy.loginKey}${attendanceNumber}`
      : attendanceNumber ?? null;

    // 학생 loginId 중복 확인
    if (studentLoginId) {
      const existingStudentUser = await prisma.user.findUnique({
        where: { academyId_loginId: { academyId, loginId: studentLoginId } },
      });
      if (existingStudentUser) {
        return NextResponse.json({ error: `출석번호 ${attendanceNumber}은(는) 이미 계정이 있습니다.` }, { status: 409 });
      }
    }

    const studentTempPassword = generateTempPassword();
    const parentTempPassword = generateTempPassword();

    // bcrypt.hash은 트랜잭션 밖에서 미리 처리
    const studentPasswordHash = studentLoginId ? await bcrypt.hash(studentTempPassword, 12) : null;
    const parentPasswordHash = parentPhone ? await bcrypt.hash(parentTempPassword, 12) : null;

    const { studentId, isNewParent } = await prisma.$transaction(async (tx) => {
      // 학생 User 생성 — loginId = loginKey + attendanceNumber (loginKey 없으면 attendanceNumber만)
      let studentUserId: string | undefined;
      if (studentLoginId && studentPasswordHash) {
        const studentUser = await tx.user.create({
          data: {
            email: `noemail.${academyId}.${studentLoginId}@acams.internal`,
            loginId: studentLoginId,
            passwordHash: studentPasswordHash,
            name,
            role: 'student',
            academyId,
          },
        });
        studentUserId = studentUser.id;
      }

      const s = await tx.student.create({
        data: {
          academyId,
          name,
          school: school ?? '',
          grade: grade ?? 1,
          phone: phone ?? null,
          status: STATUS_TO_PRISMA[status] ?? PrismaStatus.ACTIVE,
          enrollDate: enrollDate ? new Date(enrollDate) : new Date(),
          memo: memo ?? '',
          avatarColor: avatarColor ?? '#4A90D9',
          attendanceNumber: attendanceNumber ?? '',
          birthDate: birthDate ? new Date(birthDate) : null,
          ...(studentUserId ? { userId: studentUserId } : {}),
        },
      });

      // qrCode 업데이트
      await tx.student.update({
        where: { id: s.id },
        data: { qrCode: `QR-${s.id}` },
      });

      // 학부모 처리: 이미 존재하면 연결만, 없으면 새로 생성
      let newParentCreated = false;
      if (parentName || parentPhone) {
        // 같은 학원에 같은 전화번호 부모가 있는지 확인 (형제/자매 케이스)
        const existingParent = parentPhone
          ? await tx.parent.findFirst({
              where: {
                phone: parentPhone,
                children: { some: { student: { academyId } } },
              },
            })
          : null;

        if (existingParent) {
          // 기존 부모에 새 학생만 연결
          await tx.studentParent.create({
            data: { studentId: s.id, parentId: existingParent.id },
          });
        } else if (parentName) {
          // 신규 부모 생성
          let parentUserId: string | undefined;
          if (parentPhone && parentPasswordHash) {
            const parentUser = await tx.user.create({
              data: {
                email: `noemail.${academyId}.${parentPhone}@acams.internal`,
                loginId: parentPhone,
                passwordHash: parentPasswordHash,
                name: parentName,
                role: 'parent',
                academyId,
              },
            });
            parentUserId = parentUser.id;
          }
          const parent = await tx.parent.create({
            data: {
              name: parentName,
              phone: parentPhone ?? '',
              ...(parentUserId ? { userId: parentUserId } : {}),
            },
          });
          await tx.studentParent.create({
            data: { studentId: s.id, parentId: parent.id },
          });
          newParentCreated = true;
        }
      }

      return { studentId: s.id, isNewParent: newParentCreated };
    });

    const created = await prisma.student.findUnique({
      where: { id: studentId },
      include: STUDENT_INCLUDE,
    });

    // 비밀번호 SMS 발송 (응답에서 제외)
    const smsPromises: Promise<void>[] = [];
    if (studentLoginId && phone) {
      smsPromises.push(sendSms(phone, `[AcaMS] 학생 계정\nID: ${studentLoginId}\n임시PW: ${studentTempPassword}`));
    }
    if (isNewParent && parentPhone) {
      smsPromises.push(sendSms(parentPhone, `[AcaMS] 학부모 계정\nID: ${parentPhone}\n임시PW: ${parentTempPassword}`));
    }
    await Promise.all(smsPromises);

    return NextResponse.json(
      {
        ...mapStudent(created!),
        studentLoginId: studentLoginId ?? null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/students]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
