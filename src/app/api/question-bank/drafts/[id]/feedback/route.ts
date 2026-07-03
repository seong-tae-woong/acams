import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Prisma } from '@/generated/prisma/client';
import { generateQuestions } from '@/lib/ai/generate';
import { reviewGeneratedQuestions } from '@/lib/ai/review';
import { persistItems } from '@/lib/questionBank/persist';
import type { TestSpec } from '@/lib/types/questionBank';

// AI 생성+검수 시간. Fluid Compute 300초 상한(20문항 안전). Active CPU 과금이라 AI 대기시간은 사실상 미과금.
export const maxDuration = 300;

// POST /api/question-bank/drafts/[id]/feedback — 강사 피드백으로 재생성(문항 교체, 라운드+1)
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
    const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';
    if (!feedback) {
      return NextResponse.json({ error: '피드백 내용을 입력해주세요.' }, { status: 400 });
    }

    const draft = await prisma.testDraft.findFirst({
      where: { id, academyId },
      select: { id: true, spec: true, status: true, layout: true },
    });
    if (!draft) {
      return NextResponse.json({ error: '초안을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (draft.layout === 'MOCK') {
      return NextResponse.json(
        { error: '모의고사는 영역별로 재생성하세요.' },
        { status: 400 },
      );
    }
    if (draft.status === 'APPROVED' || draft.status === 'ARCHIVED') {
      return NextResponse.json(
        { error: '이미 확정된 초안은 수정할 수 없습니다.' },
        { status: 409 },
      );
    }

    const spec = draft.spec as unknown as TestSpec;

    // ── AI 호출은 트랜잭션 '밖' (Neon P2028 회피) ──
    const gen = await generateQuestions(spec, feedback);
    const review =
      gen.questions.length > 0 && !gen.refused
        ? await reviewGeneratedQuestions(gen.questions)
        : { reviews: [], usage: null, refused: false };
    const flagsByOrder = new Map(review.reviews.map((r) => [r.index, r.flags]));

    // 다음 라운드 번호(기존 최대 + 1)
    const last = await prisma.generationTurn.findFirst({
      where: { testDraftId: id },
      orderBy: { round: 'desc' },
      select: { round: true },
    });
    const round = (last?.round ?? 0) + 1;

    // ── 저장: 기존 문항 삭제(플래그 cascade) 후 재생성 ──
    await prisma.$transaction(
      async (tx) => {
        await tx.testDraftItem.deleteMany({ where: { testDraftId: id } });
        await persistItems(tx, id, gen.questions, flagsByOrder, review.usage?.model ?? null);
        await tx.generationTurn.create({
          data: {
            testDraftId: id,
            round,
            role: 'AI_REVISION',
            input: { feedback, spec } as unknown as Prisma.InputJsonValue,
            output: {
              generated: gen.questions.length,
              requested: gen.requested,
              dropped: gen.dropped,
              refused: gen.refused,
            } as unknown as Prisma.InputJsonValue,
            model: gen.usage?.model ?? review.usage?.model ?? '',
            tokensIn: (gen.usage?.tokensIn ?? 0) + (review.usage?.tokensIn ?? 0),
            tokensOut: (gen.usage?.tokensOut ?? 0) + (review.usage?.tokensOut ?? 0),
          },
        });
        // status 유지(REVIEW) + updatedAt 갱신
        await tx.testDraft.update({ where: { id }, data: { status: 'REVIEW' } });
      },
      { timeout: 20000 },
    );

    const full = await prisma.testDraft.findFirst({
      where: { id, academyId },
      include: {
        items: { orderBy: { order: 'asc' }, include: { flags: true } },
        turns: { orderBy: { round: 'asc' } },
      },
    });

    return NextResponse.json({
      draft: full,
      round,
      requested: gen.requested,
      generated: gen.questions.length,
      dropped: gen.dropped,
      incomplete: gen.incomplete,
      refused: gen.refused,
      reviewSkipped: review.refused,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error(
      '[POST /api/question-bank/drafts/[id]/feedback]',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
