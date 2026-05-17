import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ReportTemplateKind } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/communication/report-templates?kind=PER_EXAM
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const kindParam = req.nextUrl.searchParams.get('kind');
  const where: { academyId: string; kind?: ReportTemplateKind } = { academyId };
  if (kindParam === 'PER_EXAM' || kindParam === 'PERIODIC') {
    where.kind = kindParam;
  }

  // take 파라미터가 있으면 등록일(createdAt) 최신순 페이지네이션, 없으면 기존 전체 조회
  const takeParam = req.nextUrl.searchParams.get('take');
  const skipParam = req.nextUrl.searchParams.get('skip');
  const take = takeParam ? Math.max(1, Math.min(100, Number(takeParam) || 0)) : undefined;
  const skip = skipParam ? Math.max(0, Number(skipParam) || 0) : 0;

  try {
    const templates = await prisma.reportTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(take !== undefined ? { take, skip } : {}),
    });
    return NextResponse.json(templates);
  } catch (err) {
    console.error('[GET report-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// POST /api/communication/report-templates
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const body = await req.json();
    const { name, alias, kind, bodyMarkdown, layout, scopeFilter, passThreshold, periodMonths } = body;

    if (!name?.trim()) return NextResponse.json({ error: '이름을 입력하세요.' }, { status: 400 });
    if (kind !== 'PER_EXAM' && kind !== 'PERIODIC') {
      return NextResponse.json({ error: '잘못된 kind 값' }, { status: 400 });
    }

    const created = await prisma.reportTemplate.create({
      data: {
        academyId,
        name: name.trim(),
        alias: typeof alias === 'string' ? alias.trim() : '',
        kind: kind as ReportTemplateKind,
        bodyMarkdown: bodyMarkdown ?? '',
        layout: layout ?? [],
        scopeFilter: scopeFilter ?? {},
        passThreshold: typeof passThreshold === 'number' ? passThreshold : 70,
        periodMonths: kind === 'PERIODIC' && typeof periodMonths === 'number' ? periodMonths : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[POST report-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
