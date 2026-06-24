import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

function isStaff(role: string) {
  return role === 'director' || role === 'teacher' || role === 'super_admin';
}

// GET /api/level-test-comment-templates — 학원의 코멘트 양식 목록
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (!isStaff(role)) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  try {
    const list = await prisma.levelTestCommentTemplate.findMany({
      where: { academyId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, body: true },
    });
    return NextResponse.json(list);
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/level-test-comment-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/level-test-comment-templates — 코멘트 양식 생성. body: { title, body }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (!isStaff(role)) return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });

  try {
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!title) return NextResponse.json({ error: '제목을 입력하세요.' }, { status: 400 });
    if (!text) return NextResponse.json({ error: '코멘트 내용을 입력하세요.' }, { status: 400 });

    const created = await prisma.levelTestCommentTemplate.create({
      data: { academyId, title, body: text },
      select: { id: true, title: true, body: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/level-test-comment-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
