import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/question-bank/drafts/[id] — 초안 상세(문항 + 플래그 + 생성이력)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const draft = await prisma.testDraft.findFirst({
      where: { id, academyId }, // academyId 스코프 — 타 학원 초안 접근 차단
      include: {
        items: { orderBy: { order: 'asc' }, include: { flags: true } },
        turns: { orderBy: { round: 'asc' } },
      },
    });
    if (!draft) {
      return NextResponse.json({ error: '초안을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ draft });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/question-bank/drafts/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/question-bank/drafts/[id] — 인쇄 양식(layout) 변경. BASIC↔VOCAB만(모의고사 불가).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const layout = body.layout === 'VOCAB' ? 'VOCAB' : body.layout === 'BASIC' ? 'BASIC' : null;
    if (!layout) {
      return NextResponse.json({ error: '지원하지 않는 인쇄 양식입니다.' }, { status: 400 });
    }
    const cur = await prisma.testDraft.findFirst({
      where: { id, academyId }, // academyId 스코프
      select: { id: true, layout: true },
    });
    if (!cur) {
      return NextResponse.json({ error: '초안을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (cur.layout === 'MOCK') {
      return NextResponse.json({ error: '모의고사는 인쇄 양식을 바꿀 수 없습니다.' }, { status: 400 });
    }
    await prisma.testDraft.update({ where: { id }, data: { layout } });
    return NextResponse.json({ ok: true, layout });
  } catch (err) {
    await logServerError(req, err);
    console.error('[PATCH /api/question-bank/drafts/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
