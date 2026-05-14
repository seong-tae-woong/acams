import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ReportTemplateKind } from '@/generated/prisma/client';

// GET /api/communication/report-templates?kind=PER_EXAM
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kindParam = req.nextUrl.searchParams.get('kind');
  const where: { academyId: string; kind?: ReportTemplateKind } = { academyId };
  if (kindParam === 'PER_EXAM' || kindParam === 'PERIODIC') {
    where.kind = kindParam;
  }

  try {
    const templates = await prisma.reportTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(templates);
  } catch (err) {
    console.error('[GET report-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// POST /api/communication/report-templates
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
