import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/reports/batches
// 발행 묶음(batchId) 단위로 그룹핑된 발행 이력
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // batchId가 있는 Report만 그룹핑
    const reports = await prisma.report.findMany({
      where: { academyId, batchId: { not: null } },
      select: {
        batchId: true,
        kind: true,
        templateId: true,
        examId: true,
        periodLabel: true,
        title: true,
        publishedAt: true,
        publishedBy: true,
        readAt: true,
      },
      orderBy: { publishedAt: 'desc' },
    });

    // 양식·시험 메타데이터 일괄 조회
    const templateIds = Array.from(new Set(reports.map((r) => r.templateId)));
    const examIds = Array.from(new Set(reports.map((r) => r.examId).filter((v): v is string => !!v)));
    const userIds = Array.from(new Set(reports.map((r) => r.publishedBy).filter((v): v is string => !!v)));

    const [templates, exams, users] = await Promise.all([
      prisma.reportTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, name: true } }),
      examIds.length > 0
        ? prisma.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      userIds.length > 0
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    const tplMap = new Map(templates.map((t) => [t.id, t.name]));
    const examMap = new Map(exams.map((e) => [e.id, e.name]));
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // batchId로 그룹화
    const groups = new Map<string, {
      batchId: string;
      kind: 'PER_EXAM' | 'PERIODIC';
      templateName: string;
      examName: string | null;
      periodLabel: string;
      publishedAt: string;
      publishedByName: string;
      totalCount: number;
      readCount: number;
    }>();
    for (const r of reports) {
      if (!r.batchId) continue;
      const existing = groups.get(r.batchId);
      if (existing) {
        existing.totalCount += 1;
        if (r.readAt) existing.readCount += 1;
        // 더 이른 publishedAt으로 통일
        if (r.publishedAt < new Date(existing.publishedAt)) {
          existing.publishedAt = r.publishedAt.toISOString();
        }
      } else {
        groups.set(r.batchId, {
          batchId: r.batchId,
          kind: r.kind,
          templateName: tplMap.get(r.templateId) ?? '(삭제된 양식)',
          examName: r.examId ? examMap.get(r.examId) ?? null : null,
          periodLabel: r.periodLabel,
          publishedAt: r.publishedAt.toISOString(),
          publishedByName: r.publishedBy ? userMap.get(r.publishedBy) ?? '?' : '시스템',
          totalCount: 1,
          readCount: r.readAt ? 1 : 0,
        });
      }
    }

    const batches = Array.from(groups.values())
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    return NextResponse.json({ batches });
  } catch (err) {
    console.error('[GET /api/reports/batches]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
