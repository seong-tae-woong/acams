import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Prisma } from '@/generated/prisma/client';
import { generateQuestions } from '@/lib/ai/generate';
import { reviewGeneratedQuestions } from '@/lib/ai/review';
import { persistItems } from '@/lib/questionBank/persist';
import { parseTestSpec, parseLayout } from '@/lib/questionBank/spec';

// Vercel Pro — 생성+검수는 수십 초 걸릴 수 있어 함수 실행시간 상향(eng-review D3).
export const maxDuration = 300;

// POST /api/question-bank/generate — 정형 입력 → 생성 → 자동검수 → 시험지 초안 저장
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  // 강사 manageQuestionBank는 proxy(edge)가 이미 enforce. 라우트는 학부모/학생 차단(방어).
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = parseTestSpec(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const spec = parsed.spec;
    const layout = parseLayout(body.layout);

    // ── AI 호출은 트랜잭션 '밖' (Neon P2028 회피) ──
    const gen = await generateQuestions(spec);
    const review =
      gen.questions.length > 0 && !gen.refused
        ? await reviewGeneratedQuestions(gen.questions)
        : { reviews: [], usage: null, refused: false };
    const flagsByOrder = new Map(review.reviews.map((r) => [r.index, r.flags]));

    // ── 저장은 빠른 트랜잭션(createMany로 왕복 최소화) ──
    const draftId = await prisma.$transaction(
      async (tx) => {
        const draft = await tx.testDraft.create({
          data: {
            academyId,
            createdBy: userId,
            status: 'REVIEW',
            layout,
            spec: spec as unknown as Prisma.InputJsonValue,
          },
          select: { id: true },
        });

        await persistItems(tx, draft.id, gen.questions, flagsByOrder, review.usage?.model ?? null);

        await tx.generationTurn.create({
          data: {
            testDraftId: draft.id,
            round: 0,
            role: 'AI_GENERATION',
            input: spec as unknown as Prisma.InputJsonValue,
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

        return draft.id;
      },
      { timeout: 20000 },
    );

    // academyId로 스코핑해 다시 로드(items+flags+turns 포함)
    const draft = await prisma.testDraft.findFirst({
      where: { id: draftId, academyId },
      include: {
        items: { orderBy: { order: 'asc' }, include: { flags: true } },
        turns: { orderBy: { round: 'asc' } },
      },
    });

    return NextResponse.json(
      {
        draft,
        requested: gen.requested,
        generated: gen.questions.length,
        dropped: gen.dropped,
        incomplete: gen.incomplete, // 요청보다 적게 생성됨 → UI에서 '부족분 재생성' 안내
        refused: gen.refused, // 생성 자체가 거부됨
        reviewSkipped: review.refused, // 검수가 거부됨 → '미검수'(강사 전수검토)
      },
      { status: 201 },
    );
  } catch (err) {
    await logServerError(req, err);
    console.error(
      '[POST /api/question-bank/generate]',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
