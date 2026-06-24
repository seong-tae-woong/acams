import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function serialize(e: {
  id: string;
  classId: string;
  studentId: string;
  sessionDate: Date;
  attitude: number | null;
  attitudeReason: string | null;
  homeworkDone: boolean | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: e.id,
    classId: e.classId,
    studentId: e.studentId,
    sessionDate: e.sessionDate.toISOString().slice(0, 10),
    attitude: e.attitude,
    attitudeReason: e.attitudeReason,
    homeworkDone: e.homeworkDone,
    authorId: e.authorId,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

// GET /api/lessons/student-eval?classId=&date=YYYY-MM-DD
// 특정 반·날짜의 모든 학생 평가
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');
  if (!classId || !date) {
    return NextResponse.json({ error: 'classId, date 필수' }, { status: 400 });
  }

  try {
    const rows = await prisma.lessonStudentEval.findMany({
      where: { academyId, classId, sessionDate: toDateOnly(date) },
    });
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/lessons/student-eval]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/lessons/student-eval — upsert (classId+studentId+sessionDate 키)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { classId, studentId, sessionDate, attitude, attitudeReason, homeworkDone } = await req.json();
    if (!classId || !studentId || !sessionDate) {
      return NextResponse.json({ error: 'classId, studentId, sessionDate 필수' }, { status: 400 });
    }
    // attitude: 1~5 또는 null
    const att =
      attitude === null || attitude === undefined
        ? null
        : Math.trunc(Number(attitude));
    if (att !== null && (!Number.isFinite(att) || att < 1 || att > 5)) {
      return NextResponse.json({ error: '태도 점수는 1~5 또는 미입력이어야 합니다.' }, { status: 400 });
    }
    const hw = homeworkDone === null || homeworkDone === undefined ? null : Boolean(homeworkDone);

    const cls = await prisma.class.findFirst({ where: { id: classId, academyId } });
    if (!cls) return NextResponse.json({ error: '반 권한 없음' }, { status: 403 });

    const saved = await prisma.lessonStudentEval.upsert({
      where: {
        classId_studentId_sessionDate: {
          classId,
          studentId,
          sessionDate: toDateOnly(sessionDate),
        },
      },
      update: {
        attitude: att,
        attitudeReason: attitudeReason ?? null,
        homeworkDone: hw,
        authorId: userId,
      },
      create: {
        academyId,
        classId,
        studentId,
        sessionDate: toDateOnly(sessionDate),
        attitude: att,
        attitudeReason: attitudeReason ?? null,
        homeworkDone: hw,
        authorId: userId,
      },
    });

    return NextResponse.json(serialize(saved));
  } catch (err) {
    await logServerError(req, err);
    console.error('[PUT /api/lessons/student-eval]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
