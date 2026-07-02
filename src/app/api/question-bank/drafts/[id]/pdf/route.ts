/**
 * GET /api/question-bank/drafts/[id]/pdf?variant=exam|answer
 *
 * 시험지 초안 → PDF 즉석 생성.
 * - variant=exam(기본): 문항만(정답·해설 제외) — 학생 배부용
 * - variant=answer: 정답 및 해설 — 강사용
 * - 문서 트리는 pdfDocument.buildDraftPdfDocument, 폰트는 pdfFont에서.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { renderToBuffer } from '@react-pdf/renderer';
import { ensureQuestionBankFonts } from '@/lib/questionBank/pdfFont';
import { buildDraftPdfDocument } from '@/lib/questionBank/pdfDocument';
import { parseLayout } from '@/lib/questionBank/spec';
import type { TestSpec } from '@/lib/types/questionBank';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const variant = req.nextUrl.searchParams.get('variant') === 'answer' ? 'answer' : 'exam';
  const layoutOverride = req.nextUrl.searchParams.get('layout'); // 옵션: 미리보기용 오버라이드

  try {
    const draft = await prisma.testDraft.findFirst({
      where: { id, academyId }, // academyId 스코프 — 타 학원 초안 차단
      select: {
        id: true,
        spec: true,
        layout: true,
        academy: { select: { name: true } },
        items: {
          orderBy: { order: 'asc' },
          select: { id: true, content: true, answer: true, explanation: true, isKiller: true },
        },
      },
    });
    if (!draft) {
      return NextResponse.json({ error: '초안을 찾을 수 없습니다.' }, { status: 404 });
    }

    ensureQuestionBankFonts();

    const doc = buildDraftPdfDocument({
      academyName: draft.academy?.name ?? '',
      spec: draft.spec as unknown as TestSpec,
      items: draft.items,
      variant,
      layout: layoutOverride ? parseLayout(layoutOverride) : draft.layout,
    });

    const pdfBuffer = await renderToBuffer(doc);
    const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
    const filename = `test-draft-${draft.id}-${variant}.pdf`;

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    await logServerError(req, err);
    console.error(
      '[GET /api/question-bank/drafts/[id]/pdf]',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: 'PDF 생성 실패' }, { status: 500 });
  }
}
