import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function serialize(
  n: {
    id: string;
    classId: string;
    sessionDate: Date;
    content: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
  },
  authorName?: string | null,
) {
  return {
    id: n.id,
    classId: n.classId,
    sessionDate: n.sessionDate.toISOString().slice(0, 10),
    content: n.content,
    authorId: n.authorId,
    authorName: authorName ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

// GET /api/lessons/session-note?classId=&date=YYYY-MM-DD
// 특정 반·날짜의 수업 내용(학생 공통). 없으면 null.
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
    const row = await prisma.lessonSessionNote.findFirst({
      where: { academyId, classId, sessionDate: toDateOnly(date) },
    });
    if (!row) return NextResponse.json(null);
    const author = await prisma.user.findUnique({
      where: { id: row.authorId },
      select: { name: true },
    });
    return NextResponse.json(serialize(row, author?.name ?? null));
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/lessons/session-note]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/lessons/session-note — upsert (classId+sessionDate 키)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { classId, sessionDate, content } = await req.json();
    if (!classId || !sessionDate) {
      return NextResponse.json({ error: 'classId, sessionDate 필수' }, { status: 400 });
    }

    const cls = await prisma.class.findFirst({ where: { id: classId, academyId } });
    if (!cls) return NextResponse.json({ error: '반 권한 없음' }, { status: 403 });

    const saved = await prisma.lessonSessionNote.upsert({
      where: {
        classId_sessionDate: {
          classId,
          sessionDate: toDateOnly(sessionDate),
        },
      },
      update: { content: content ?? '', authorId: userId },
      create: {
        academyId,
        classId,
        sessionDate: toDateOnly(sessionDate),
        content: content ?? '',
        authorId: userId,
      },
    });

    const author = await prisma.user.findUnique({
      where: { id: saved.authorId },
      select: { name: true },
    });
    return NextResponse.json(serialize(saved, author?.name ?? null));
  } catch (err) {
    await logServerError(req, err);
    console.error('[PUT /api/lessons/session-note]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
