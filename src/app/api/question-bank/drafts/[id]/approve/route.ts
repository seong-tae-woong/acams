import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { bankQuestionCreateData } from '@/lib/questionBank/promote';
import type { TestSpec } from '@/lib/types/questionBank';

// POST /api/question-bank/drafts/[id]/approve — 승인 + 문항은행 적재(플라이휠)
// body: { override?: boolean } — 미해결 ERROR 플래그가 있어도 강사가 강제 승인
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const body = await req.json().catch(() => ({}));
    const override = !!(body as { override?: unknown }).override;

    const draft = await prisma.testDraft.findFirst({
      where: { id, academyId },
      include: { items: { include: { flags: true } } },
    });
    if (!draft) {
      return NextResponse.json({ error: '초안을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (draft.status === 'APPROVED') {
      return NextResponse.json({ error: '이미 승인된 초안입니다.' }, { status: 409 });
    }
    if (draft.items.length === 0) {
      return NextResponse.json({ error: '문항이 없어 승인할 수 없습니다.' }, { status: 400 });
    }

    // 오답 인쇄 0 게이트 — 미해결 ERROR 플래그가 있으면 override 없이는 승인 차단
    const unresolvedErrors = draft.items.reduce(
      (n, it) => n + it.flags.filter((f) => f.severity === 'ERROR' && !f.resolved).length,
      0,
    );
    if (unresolvedErrors > 0 && !override) {
      return NextResponse.json(
        {
          error: '미해결 오류(ERROR) 플래그가 있어 승인할 수 없습니다. 검토 후 다시 시도해주세요.',
          unresolvedErrors,
        },
        { status: 422 },
      );
    }

    const spec = draft.spec as unknown as TestSpec;

    await prisma.$transaction(
      async (tx) => {
        // 승인 문항 → BankQuestion 적재(플라이휠)
        await tx.bankQuestion.createMany({
          data: draft.items.map((it) =>
            bankQuestionCreateData(it, spec.subject, spec.gradeLevel, academyId, userId),
          ),
        });
        // override 승인이면 남은 ERROR 플래그를 해결처리(강사가 검토했다는 기록)
        if (override && unresolvedErrors > 0) {
          await tx.qualityFlag.updateMany({
            where: { testDraftItem: { testDraftId: id }, severity: 'ERROR', resolved: false },
            data: { resolved: true, resolvedBy: userId },
          });
        }
        await tx.testDraft.update({ where: { id }, data: { status: 'APPROVED' } });
      },
      { timeout: 20000 },
    );

    return NextResponse.json({ approved: true, promoted: draft.items.length, overridden: override });
  } catch (err) {
    await logServerError(req, err);
    console.error(
      '[POST /api/question-bank/drafts/[id]/approve]',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
