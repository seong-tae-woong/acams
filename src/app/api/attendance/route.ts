import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { AttendanceStatus as PrismaStatus } from '@/generated/prisma/client';

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
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');
  const studentId = searchParams.get('studentId');
  const month = searchParams.get('month'); // 'YYYY-MM'

  try {
    const records = await prisma.attendanceRecord.findMany({
      where: {
        academyId,
        ...(classId ? { classId } : {}),
        ...(studentId ? { studentId } : {}),
        ...(date ? { date: new Date(date) } : {}),
        ...(month && !date
          ? {
              date: {
                gte: new Date(`${month}-01`),
                lt: new Date(
                  month.slice(0, 4) + '-' +
                  String(parseInt(month.slice(5, 7)) + 1).padStart(2, '0') + '-01'
                ),
              },
            }
          : {}),
      },
      include: INCLUDE,
      orderBy: [{ date: 'desc' }, { student: { name: 'asc' } }],
    });

    return NextResponse.json(records.map(mapRecord));
  } catch (err) {
    console.error('[GET /api/attendance]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/attendance — bulk upsert
// body: { classId, date, records: [{ studentId, status, checkInTime?, checkOutTime?, memo? }] }
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');

  // checkedById is Teacher.id — only set when a teacher is checking in
  let checkedById: string | null = null;
  if (userId && userRole === 'teacher') {
    const teacher = await prisma.teacher.findFirst({ where: { userId }, select: { id: true } });
    checkedById = teacher?.id ?? null;
  }

  try {
    const body = await req.json();
    const { classId, date, records } = body;

    if (!classId || !date || !Array.isArray(records)) {
      return NextResponse.json({ error: 'classId, date, records 는 필수입니다.' }, { status: 400 });
    }

    const dateObj = new Date(date);

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
    console.error('[POST /api/attendance]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
