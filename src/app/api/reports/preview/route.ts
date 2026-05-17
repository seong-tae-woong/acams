import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { renderBody } from '@/lib/reports/tokens';
import { buildPerExamContexts } from '@/lib/reports/buildContext';
import { requireAuth } from '@/lib/auth/requireAuth';

// POST /api/reports/preview
// body: { examId, studentId, passThreshold?, templateId?, bodyMarkdown? }
//   - bodyMarkdown 우선 (양식 작성 중 실시간 미리보기 / 발행시 본문 override 미리보기)
//   - 없으면 templateId로 양식 조회
// → { renderedBody, raw, context }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const { templateId, examId, studentId, passThreshold, bodyMarkdown } = await req.json();
    if (!examId || !studentId) {
      return NextResponse.json({ error: 'examId, studentId 필수' }, { status: 400 });
    }

    let body: string | null = null;
    let threshold = typeof passThreshold === 'number' ? passThreshold : 70;

    if (typeof bodyMarkdown === 'string') {
      body = bodyMarkdown;
    } else {
      if (!templateId) return NextResponse.json({ error: 'templateId 또는 bodyMarkdown 필요' }, { status: 400 });
      const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, academyId } });
      if (!template) return NextResponse.json({ error: '양식 없음' }, { status: 404 });
      body = template.bodyMarkdown;
      if (typeof passThreshold !== 'number') threshold = template.passThreshold;
    }

    const ctxMap = await buildPerExamContexts(examId, [studentId], threshold);
    const ctx = ctxMap.get(studentId);
    if (!ctx) return NextResponse.json({ error: '학생 정보 없음' }, { status: 404 });

    const renderedBody = renderBody(body ?? '', ctx.context);
    return NextResponse.json({
      renderedBody,
      raw: ctx.raw,
      context: ctx.context,
    });
  } catch (err) {
    console.error('[POST /api/reports/preview]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
