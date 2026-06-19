import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { normalizeFormTypesAndMap } from '@/lib/levelTest/formValidation';
import type { LevelTestType, QuestionMapEntry } from '@/lib/levelTest/types';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/level-test-forms/[id] — 양식 단건
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;
  const { id } = await ctx.params;

  try {
    const f = await prisma.levelTestForm.findFirst({ where: { id, academyId, isActive: true } });
    if (!f) return NextResponse.json({ error: '양식을 찾을 수 없습니다.' }, { status: 404 });

    const questionMap = (f.questionMap as unknown as QuestionMapEntry[]) ?? [];
    return NextResponse.json({
      id: f.id,
      grade: f.grade,
      subject: f.subject,
      title: f.title,
      pdfUrl: f.pdfUrl,
      types: (f.types as unknown as LevelTestType[]) ?? [],
      questionMap,
      totalQuestions: questionMap.length,
      showAverage: f.showAverage,
    });
  } catch (err) {
    console.error('[GET /api/level-test-forms/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/level-test-forms/[id] — 양식 수정 (메타 또는 types/questionMap)
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const exists = await prisma.levelTestForm.findFirst({ where: { id, academyId, isActive: true }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: '양식을 찾을 수 없습니다.' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (typeof body.title === 'string') {
      if (!body.title.trim()) return NextResponse.json({ error: '양식 이름은 비울 수 없습니다.' }, { status: 400 });
      data.title = body.title.trim();
    }
    if (typeof body.subject === 'string') data.subject = body.subject;
    if (Number.isInteger(body.grade)) data.grade = body.grade;
    if ('pdfUrl' in body) data.pdfUrl = typeof body.pdfUrl === 'string' && body.pdfUrl ? body.pdfUrl : null;
    if (typeof body.showAverage === 'boolean') data.showAverage = body.showAverage;

    // types/questionMap은 짝지어 검증 (questionMap이 types에 의존)
    if ('types' in body || 'questionMap' in body) {
      const v = normalizeFormTypesAndMap(body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      data.types = v.types as unknown as object;
      data.questionMap = v.questionMap as unknown as object;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    await prisma.levelTestForm.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/level-test-forms/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/level-test-forms/[id] — 소프트 삭제 (실시된 시험의 스냅샷 보존)
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const exists = await prisma.levelTestForm.findFirst({ where: { id, academyId, isActive: true }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: '양식을 찾을 수 없습니다.' }, { status: 404 });

    await prisma.levelTestForm.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/level-test-forms/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
