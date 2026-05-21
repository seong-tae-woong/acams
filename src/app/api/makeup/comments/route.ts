import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

function serialize(c: {
  id: string;
  makeupClassId: string;
  studentId: string;
  comment: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    makeupClassId: c.makeupClassId,
    studentId: c.studentId,
    comment: c.comment,
    authorId: c.authorId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// GET /api/makeup/comments?makeupClassId=
// 특정 보강의 모든 학생 코멘트
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const makeupClassId = searchParams.get('makeupClassId');
  if (!makeupClassId) {
    return NextResponse.json({ error: 'makeupClassId 필수' }, { status: 400 });
  }

  try {
    // 보강 권한 검증 (멀티테넌트)
    const mc = await prisma.makeupClass.findFirst({
      where: { id: makeupClassId, academyId },
      select: { id: true },
    });
    if (!mc) return NextResponse.json({ error: '보강 권한 없음' }, { status: 403 });

    const rows = await prisma.makeupComment.findMany({
      where: { academyId, makeupClassId },
    });
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    console.error('[GET /api/makeup/comments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/makeup/comments — upsert (makeupClassId+studentId 키)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId } = auth;

  try {
    const { makeupClassId, studentId, comment } = await req.json();
    if (!makeupClassId || !studentId) {
      return NextResponse.json({ error: 'makeupClassId, studentId 필수' }, { status: 400 });
    }

    const mc = await prisma.makeupClass.findFirst({
      where: { id: makeupClassId, academyId },
      select: { id: true },
    });
    if (!mc) return NextResponse.json({ error: '보강 권한 없음' }, { status: 403 });

    const saved = await prisma.makeupComment.upsert({
      where: {
        makeupClassId_studentId: { makeupClassId, studentId },
      },
      update: { comment: comment ?? '', authorId: userId },
      create: {
        academyId,
        makeupClassId,
        studentId,
        comment: comment ?? '',
        authorId: userId,
      },
    });

    return NextResponse.json(serialize(saved));
  } catch (err) {
    console.error('[PUT /api/makeup/comments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
