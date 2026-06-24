import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { AttendanceStatus as PrismaStatus } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';

const STATUS_TO_PRISMA: Record<string, PrismaStatus> = {
  '출석': PrismaStatus.PRESENT,
  '결석': PrismaStatus.ABSENT,
  '지각': PrismaStatus.LATE,
  '조퇴': PrismaStatus.EARLY_LEAVE,
};

const STATUS_TO_UI: Record<PrismaStatus, string> = {
  [PrismaStatus.PRESENT]: '출석',
  [PrismaStatus.ABSENT]: '결석',
  [PrismaStatus.LATE]: '지각',
  [PrismaStatus.EARLY_LEAVE]: '조퇴',
};

const INCLUDE = {
  student: { select: { name: true } },
  class: { select: { name: true } },
  checkedBy: { select: { id: true } },
} as const;

function mapRecord(r: {
  id: string; studentId: string; classId: string;
  date: Date; status: PrismaStatus;
  checkInTime: string | null; checkOutTime: string | null;
  memo: string; checkedAt: Date;
  student: { name: string };
  class: { name: string };
  checkedBy: { id: string } | null;
}) {
  return {
    id: r.id,
    studentId: r.studentId,
    studentName: r.student.name,
    classId: r.classId,
    className: r.class.name,
    date: r.date.toISOString().slice(0, 10),
    status: STATUS_TO_UI[r.status],
    checkInTime: r.checkInTime,
    checkOutTime: r.checkOutTime,
    memo: r.memo,
    checkedBy: r.checkedBy?.id ?? 'system',
    checkedAt: r.checkedAt.toISOString(),
  };
}

// GET /api/attendance?classId=&date=&studentId=&month=
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');
  const studentId = searchParams.get('studentId');
  const month = searchParams.get('month'); // 'YYYY-MM'

  try {
    const monthRange = month && !date
      ? {
          gte: new Date(`${month}-01`),
          lt: new Date(
            month.slice(0, 4) + '-' +
            String(parseInt(month.slice(5, 7)) + 1).padStart(2, '0') + '-01'
          ),
        }
      : null;

    const records = await prisma.attendanceRecord.findMany({
      where: {
        academyId,
        ...(classId ? { classId } : {}),
        ...(studentId ? { studentId } : {}),
        ...(date ? { date: new Date(date) } : {}),
        ...(monthRange ? { date: monthRange } : {}),
      },
      include: INCLUDE,
      orderBy: [{ date: 'desc' }, { student: { name: 'asc' } }],
    });

    // 보강 출결도 함께 조회 (학생별 status 가 기록된 항목만)
    const makeupRecords = await prisma.makeupClass.findMany({
      where: {
        academyId,
        ...(classId ? { originalClassId: classId } : {}),
        ...(date ? { makeupDate: new Date(date) } : {}),
        ...(monthRange ? { makeupDate: monthRange } : {}),
        targets: {
          some: {
            status: { not: null },
            ...(studentId ? { studentId } : {}),
          },
        },
      },
      include: {
        originalClass: { select: { name: true } },
        targets: {
          where: {
            status: { not: null },
            ...(studentId ? { studentId } : {}),
          },
          select: {
            studentId: true,
            status: true,
            memo: true,
            student: { select: { name: true } },
          },
        },
      },
    });

    const makeupMapped = makeupRecords.flatMap((m) =>
      m.targets.map((t) => ({
        id: `makeup-${m.id}-${t.studentId}`,
        studentId: t.studentId,
        studentName: t.student.name,
        classId: m.originalClassId,
        className: `${m.originalClass.name} (보강)`,
        date: m.makeupDate.toISOString().slice(0, 10),
        status: t.status ? STATUS_TO_UI[t.status] : '출석',
        checkInTime: null as string | null,
        checkOutTime: null as string | null,
        memo: t.memo,
        checkedBy: 'system',
        checkedAt: m.makeupDate.toISOString(),
        isMakeup: true,
      })),
    );

    return NextResponse.json([...records.map(mapRecord), ...makeupMapped]);
  } catch (err) {
    console.error('[GET /api/attendance]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/attendance — bulk upsert
// body: { classId, date, records: [{ studentId, status, checkInTime?, checkOutTime?, memo? }] }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role: userRole } = auth;
  if (userRole !== 'director' && userRole !== 'teacher' && userRole !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { classId, date, records } = body;

    if (!classId || !date || !Array.isArray(records)) {
      return NextResponse.json({ error: 'classId, date, records 는 필수입니다.' }, { status: 400 });
    }

    const dateObj = new Date(date);

    // checkedById(Teacher.id)는 "누가 체크했는지" 기록용 메타데이터 — 강사가 체크할 때만 설정.
    // 강사 경로에서만 도는 추가 조회이므로, 이 조회가 실패해도 출결 저장 자체는 막지 않는다
    // (감사 정보보다 출결 저장이 우선). academyId로 스코프해 멀티테넌트 안전성도 확보.
    let checkedById: string | null = null;
    if (userId && userRole === 'teacher') {
      try {
        const teacher = await prisma.teacher.findFirst({ where: { userId, academyId }, select: { id: true } });
        checkedById = teacher?.id ?? null;
      } catch (lookupErr) {
        console.error('[POST /api/attendance] checkedBy 조회 실패 — null로 저장 진행', lookupErr instanceof Error ? lookupErr.message : String(lookupErr));
      }
    }

    // 출결 일괄 upsert — 모든 레코드를 커밋한 뒤 청구서 재계산하도록 트랜잭션으로 묶음
    const upserted = await prisma.$transaction(
      records.map((r: {
        studentId: string;
        status: string;
        checkInTime?: string;
        checkOutTime?: string;
        memo?: string;
      }) =>
        prisma.attendanceRecord.upsert({
          where: {
            studentId_classId_date: {
              studentId: r.studentId,
              classId,
              date: dateObj,
            },
          },
          update: {
            status: STATUS_TO_PRISMA[r.status] ?? PrismaStatus.PRESENT,
            checkInTime: r.checkInTime ?? null,
            checkOutTime: r.checkOutTime ?? null,
            memo: r.memo ?? '',
            checkedById: checkedById || undefined,
            checkedAt: new Date(),
          },
          create: {
            academyId,
            studentId: r.studentId,
            classId,
            date: dateObj,
            status: STATUS_TO_PRISMA[r.status] ?? PrismaStatus.PRESENT,
            checkInTime: r.checkInTime ?? null,
            checkOutTime: r.checkOutTime ?? null,
            memo: r.memo ?? '',
            checkedById: checkedById || undefined,
            checkedAt: new Date(),
          },
          include: INCLUDE,
        })
      )
    );

    return NextResponse.json(upserted.map(mapRecord));
  } catch (err) {
    // Prisma 에러는 code/meta에 실제 원인(FK 위반·커넥션 등)이 담기므로 함께 남긴다 — 운영 500 추적용
    const e = err as { code?: string; message?: string; meta?: unknown };
    console.error('[POST /api/attendance]', {
      role: userRole,
      code: e.code ?? null,
      message: e.message ?? String(err),
      meta: e.meta ?? null,
    });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
