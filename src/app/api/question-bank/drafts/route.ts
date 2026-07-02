import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/question-bank/drafts — 시험지 초안 목록(학원 스코프, 최신순)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const drafts = await prisma.testDraft.findMany({
      where: { academyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        spec: true,
        status: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    });
    return NextResponse.json({ drafts });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/question-bank/drafts]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
