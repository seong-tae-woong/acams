import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Prisma } from '@/generated/prisma/client';
import { parseMockSpec } from '@/lib/questionBank/spec';

// POST /api/question-bank/mock — 모의고사 초안 생성(빈 껍데기). 섹션별 생성은 /drafts/[id]/section.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = parseMockSpec(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const draft = await prisma.testDraft.create({
      data: {
        academyId,
        createdBy: userId,
        status: 'GENERATING', // 섹션 생성 완료 시 REVIEW로
        layout: 'MOCK',
        title: parsed.spec.title ?? '',
        spec: parsed.spec as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return NextResponse.json(
      { draftId: draft.id, sectionCount: parsed.spec.sections.length },
      { status: 201 },
    );
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/question-bank/mock]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
