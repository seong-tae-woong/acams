import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Prisma } from '@/generated/prisma/client';
import { generateQuestions } from '@/lib/ai/generate';
import { reviewGeneratedQuestions } from '@/lib/ai/review';
import { persistItems } from '@/lib/questionBank/persist';
import { sectionToTestSpec } from '@/lib/questionBank/spec';
import type { MockSpec } from '@/lib/types/questionBank';

// 섹션당 ≤10문항 → 60초 안전(Hobby). 클라이언트가 섹션을 순차 호출.
export const maxDuration = 60;

// POST /api/question-bank/drafts/[id]/section — 모의고사 한 섹션 생성·검수·추가
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const sectionIndex = Number(body.sectionIndex);
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0) {
      return NextResponse.json({ error: '잘못된 섹션 인덱스입니다.' }, { status: 400 });
    }

    const draft = await prisma.testDraft.findFirst({
      where: { id, academyId },
      select: { id: true, spec: true, status: true, layout: true },
    });
    if (!draft) {
      return NextResponse.json({ error: '초안을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (draft.layout !== 'MOCK') {
      return NextResponse.json({ error: '모의고사 초안이 아닙니다.' }, { status: 400 });
    }
    if (draft.status === 'APPROVED' || draft.status === 'ARCHIVED') {
      return NextResponse.json({ error: '이미 확정된 초안입니다.' }, { status: 409 });
    }
    const mock = draft.spec as unknown as MockSpec;
    if (!Array.isArray(mock.sections) || sectionIndex >= mock.sections.length) {
      return NextResponse.json({ error: '잘못된 섹션입니다.' }, { status: 400 });
    }

    const sectionSpec = sectionToTestSpec(mock, sectionIndex);
    const isLast = sectionIndex === mock.sections.length - 1;

    // ── AI 호출은 트랜잭션 '밖' (Neon P2028 회피) ──
    const gen = await generateQuestions(sectionSpec);
    const review =
      gen.questions.length > 0 && !gen.refused
        ? await reviewGeneratedQuestions(gen.questions)
        : { reviews: [], usage: null, refused: false };
    const flagsByOrder = new Map(review.reviews.map((r) => [r.index, r.flags]));

    await prisma.$transaction(
      async (tx) => {
        // 재생성 대비: 이 섹션 기존 문항 제거 후, 앞 섹션 문항 수를 order 오프셋으로
        await tx.testDraftItem.deleteMany({ where: { testDraftId: id, section: sectionIndex } });
        const orderOffset = await tx.testDraftItem.count({
          where: { testDraftId: id, section: { lt: sectionIndex } },
        });
        await persistItems(tx, id, gen.questions, flagsByOrder, review.usage?.model ?? null, {
          section: sectionIndex,
          orderOffset,
        });
        await tx.generationTurn.create({
          data: {
            testDraftId: id,
            round: sectionIndex,
            role: 'AI_GENERATION',
            input: sectionSpec as unknown as Prisma.InputJsonValue,
            output: {
              section: sectionIndex,
              generated: gen.questions.length,
              requested: gen.requested,
              refused: gen.refused,
            } as unknown as Prisma.InputJsonValue,
            model: gen.usage?.model ?? review.usage?.model ?? '',
            tokensIn: (gen.usage?.tokensIn ?? 0) + (review.usage?.tokensIn ?? 0),
            tokensOut: (gen.usage?.tokensOut ?? 0) + (review.usage?.tokensOut ?? 0),
          },
        });
        if (isLast) {
          await tx.testDraft.update({ where: { id }, data: { status: 'REVIEW' } });
        }
      },
      { timeout: 20000 },
    );

    return NextResponse.json({
      section: sectionIndex,
      label: mock.sections[sectionIndex].label ?? null,
      generated: gen.questions.length,
      requested: gen.requested,
      incomplete: gen.incomplete,
      refused: gen.refused,
      reviewSkipped: review.refused,
      done: isLast,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error(
      '[POST /api/question-bank/drafts/[id]/section]',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
