import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { StudentStatus as PrismaStatus } from '@/generated/prisma/client';
import { sendSms } from '@/lib/sms/solapi';
import { requireAuth } from '@/lib/auth/requireAuth';
import { validateTempPassword } from '@/lib/auth/passwordValidator';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[randomInt(chars.length)]).join('');
}

// Prisma unique constraint(P2002) 판별 — 형제 동시 등록 시 학부모 User 충돌 감지용
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'P2002';
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

// POST와 GET /id 에서 상세 데이터 조회 시 사용 (4 JOIN 유지)
const STUDENT_INCLUDE = {
  parentLinks: { include: { parent: { select: { name: true, phone: true } } } },
  classEnrollments: { select: { classId: true, isActive: true } },
  siblingLinks: { select: { studentBId: true } },
  siblingOf: { select: { studentAId: true } },
} as const;

// 목록 전용 슬림 매핑 (classEnrollments + parentLinks(연락처 검색용) JOIN, siblingLinks·siblingOf 제거)
function mapStudentListItem(s: {
  id: string; name: string; school: string; grade: number;
  status: PrismaStatus; avatarColor: string; attendanceNumber: string;
  phone: string | null;
  parentLinks: { parent: { phone: string } }[];
  classEnrollments: { classId: string }[];
}) {
  return {
    id: s.id,
    name: s.name,
    school: s.school,
    grade: s.grade,
    status: STATUS_TO_UI[s.status],
    avatarColor: s.avatarColor,
    attendanceNumber: s.attendanceNumber,
    phone: s.phone ?? '',
    parentPhone: s.parentLinks[0]?.parent.phone ?? '',
    classes: s.classEnrollments.map((e) => e.classId),
  };
}

// GET /api/students?status=&q=
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

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
      // 목록: classEnrollments + parentLinks(연락처 검색용) JOIN. siblingLinks·siblingOf 제거
      select: {
        id: true,
        name: true,
        school: true,
        grade: true,
        status: true,
        avatarColor: true,
        attendanceNumber: true,
        phone: true,
        parentLinks: { select: { parent: { select: { phone: true } } } },
        classEnrollments: {
          where: { isActive: true },
          select: { classId: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(students.map(mapStudentListItem));
  } catch (err) {
    console.error('[GET /api/students]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/students — 학생 등록
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  // 학생 등록 권한: 원장·슈퍼어드민 + 강사(학생관리 권한). 강사의 학생관리 권한은
  // proxy(edge)가 POST /api/students를 manageStudents 규칙으로 이미 차단하므로 여기선 역할만 확인.
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name, school, grade, phone, parentName, parentPhone,
      status, enrollDate, memo, avatarColor, attendanceNumber, birthDate,
      customStudentPassword, customParentPassword,
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

    // 학원 loginKey + smsEnabled 조회 — 학생 loginId = loginKey + attendanceNumber
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { loginKey: true, smsEnabled: true },
    });
    const smsEnabled = academy?.smsEnabled ?? true; // null/undefined 대비 안전 fallback (default true)
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

    // 비밀번호 결정:
    // - smsEnabled=true: 8자 자동생성 (현재 동작)
    // - smsEnabled=false: 원장이 직접 지정한 customStudentPassword/customParentPassword 사용, 약식 검증
    let studentTempPassword: string;
    let parentTempPassword: string;
    if (smsEnabled) {
      studentTempPassword = generateTempPassword();
      parentTempPassword = generateTempPassword();
    } else {
      // 학생 계정이 생성되는 경우에만 학생 비번 검증 (studentLoginId 있을 때)
      if (studentLoginId) {
        const v = validateTempPassword(customStudentPassword ?? '', studentLoginId, name);
        if (!v.valid) return NextResponse.json({ error: `학생 임시 비밀번호: ${v.error}` }, { status: 400 });
        studentTempPassword = customStudentPassword;
      } else {
        studentTempPassword = '';
      }
      // 학부모 계정이 새로 생성되는 경우에만 학부모 비번 검증 (parentPhone 있을 때)
      if (parentPhone) {
        const v = validateTempPassword(customParentPassword ?? '', parentPhone, parentName ?? '');
        if (!v.valid) return NextResponse.json({ error: `학부모 임시 비밀번호: ${v.error}` }, { status: 400 });
        parentTempPassword = customParentPassword;
      } else {
        parentTempPassword = '';
      }
    }

    // bcrypt.hash은 트랜잭션 밖에서 미리 처리
    const studentPasswordHash = studentLoginId ? await bcrypt.hash(studentTempPassword, 12) : null;
    const parentPasswordHash = parentPhone ? await bcrypt.hash(parentTempPassword, 12) : null;

    // 형제/자매 동시 등록 경합 대비(중복 학부모/계정 방지): 같은 전화번호 학부모 User를 다른
    // 트랜잭션이 먼저 생성하면 User(@@unique[academyId, loginId=phone]) 충돌(P2002)이 난다.
    // 이때 한 번 재시도하면 existingParent 조회가 방금 커밋된 학부모를 찾아 그 학부모에 연결한다.
    const runRegistration = () => prisma.$transaction(async (tx) => {
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
            // smsEnabled=true(자동생성/SMS 발송): 첫 로그인 시 변경 강제
            // smsEnabled=false(테스트 모드/원장 지정): 같은 비번 재사용을 위해 강제 안 함
            mustChangePassword: smsEnabled,
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
                mustChangePassword: smsEnabled,
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

    // 최초 시도 → 학부모 User 경합(P2002)이면 1회 재시도(재시도 시 기존 학부모에 연결됨)
    let result: Awaited<ReturnType<typeof runRegistration>>;
    try {
      result = await runRegistration();
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      result = await runRegistration();
    }
    const { studentId, isNewParent } = result;

    const created = await prisma.student.findUnique({
      where: { id: studentId },
      include: STUDENT_INCLUDE,
    });

    // 비밀번호 SMS 발송 (응답에서 제외)
    // - smsEnabled=false면 원장이 화면에서 PW 확인 후 직접 전달 → 발송 스킵
    // - 학생 계정: 학생 phone 있으면 학생에게, 학부모 phone 있으면 학부모에게도 발송
    // - 학부모 계정: 신규 가입한 경우에만 학부모에게 발송
    if (smsEnabled) {
      const smsPromises: Promise<void>[] = [];
      if (studentLoginId) {
        const studentMsg = `[학원로그] 학생 계정\nID: ${studentLoginId}\n임시PW: ${studentTempPassword}`;
        if (phone) {
          smsPromises.push(sendSms(phone, studentMsg));
        }
        if (parentPhone) {
          smsPromises.push(
            sendSms(parentPhone, `[학원로그] 자녀(${name}) 학생 계정\nID: ${studentLoginId}\n임시PW: ${studentTempPassword}`),
          );
        }
      }
      if (isNewParent && parentPhone) {
        smsPromises.push(sendSms(parentPhone, `[학원로그] 학부모 계정\nID: ${parentPhone}\n임시PW: ${parentTempPassword}`));
      }
      await Promise.all(smsPromises);
    }

    // 형제/자매 후보 감지: 같은 학원 + 같은 보호자 전화번호를 가진 다른 학생
    // Parent 모델에 academyId 없으므로 Student.academyId + parentLinks 경유로 스코프
    const siblingCandidates = parentPhone
      ? await prisma.student.findMany({
          where: {
            academyId,
            id: { not: studentId },
            parentLinks: {
              some: { parent: { phone: parentPhone } },
            },
          },
          select: {
            id: true,
            name: true,
            school: true,
            grade: true,
            avatarColor: true,
          },
        })
      : [];

    return NextResponse.json(
      {
        ...mapStudent(created!),
        studentLoginId: studentLoginId ?? null,
        // smsEnabled=true: 임시 비밀번호는 SMS로만 전달 — 평문을 클라이언트로 보내지 않음(화면 미노출)
        // smsEnabled=false(테스트 모드): 원장이 화면에서 확인 후 직접 전달
        studentTempPassword: !smsEnabled && studentLoginId ? studentTempPassword : null,
        parentTempPassword: !smsEnabled && isNewParent ? parentTempPassword : null,
        parentAccountCreated: isNewParent, // 신규 학부모 계정 생성 여부 (모달 안내 분기)
        smsEnabled, // 클라이언트에서 안내 문구 분기에 사용
        siblingCandidates,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/students]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
