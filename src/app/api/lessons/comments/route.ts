import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function serialize(c: {
  id: string;
  classId: string;
  studentId: string;
  sessionDate: Date;
  comment: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    classId: c.classId,
    studentId: c.studentId,
    sessionDate: c.sessionDate.toISOString().slice(0, 10),
    comment: c.comment,
    authorId: c.authorId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// GET /api/lessons/comments?classId=&date=YYYY-MM-DD
// 특정 반·날짜의 모든 학생 코멘트
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
    const rows = await prisma.lessonComment.findMany({
      where: { academyId, classId, sessionDate: toDateOnly(date) },
    });
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    console.error('[GET /api/lessons/comments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/lessons/comments — upsert (classId+studentId+sessionDate 키)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { classId, studentId, sessionDate, comment } = await req.json();
    if (!classId || !studentId || !sessionDate) {
      return NextResponse.json({ error: 'classId, studentId, sessionDate 필수' }, { status: 400 });
    }

    const cls = await prisma.class.findFirst({ where: { id: classId, academyId } });
    if (!cls) return NextResponse.json({ error: '반 권한 없음' }, { status: 403 });

    const saved = await prisma.lessonComment.upsert({
      where: {
        classId_studentId_sessionDate: {
          classId,
          studentId,
          sessionDate: toDateOnly(sessionDate),
        },
      },
      update: { comment: comment ?? '', authorId: userId },
      create: {
        academyId,
        classId,
        studentId,
        sessionDate: toDateOnly(sessionDate),
        comment: comment ?? '',
        authorId: userId,
      },
    });

    return NextResponse.json(serialize(saved));
  } catch (err) {
    console.error('[PUT /api/lessons/comments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
