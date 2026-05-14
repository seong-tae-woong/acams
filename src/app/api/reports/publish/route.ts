import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ReportTemplateKind } from '@/generated/prisma/client';
import { renderBody } from '@/lib/reports/tokens';
import { buildPerExamContexts } from '@/lib/reports/buildContext';
import { sendPushToStudents } from '@/lib/push/sendPush';

// POST /api/reports/publish
// body: { templateId, examId, classIds?: string[], studentIds?: string[], passThreshold?: number, summary?: string }
//   - 둘 중 하나 이상 필수: classIds(반 전체) 또는 studentIds(개별)
//   - 둘 다 주면 합집합
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { templateId, examId, classIds, studentIds, passThreshold, summary, overrideBody, overrideTitle } = body as {
      templateId: string;
      examId: string;
      classIds?: string[];
      studentIds?: string[];
      passThreshold?: number;
      summary?: string;
      overrideBody?: string;   // 이번 발행만 본문 override (양식은 그대로)
      overrideTitle?: string;  // 이번 발행만 제목 override
    };

    if (!templateId || !examId) {
      return NextResponse.json({ error: 'templateId, examId 필수' }, { status: 400 });
    }

    const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, academyId } });
    if (!template) return NextResponse.json({ error: '양식을 찾을 수 없음' }, { status: 404 });
    if (template.kind !== ReportTemplateKind.PER_EXAM) {
      return NextResponse.json({ error: '시험별 양식만 사용 가능' }, { status: 400 });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, academyId },
      include: { class: { select: { id: true, name: true } } },
    });
    if (!exam) return NextResponse.json({ error: '시험을 찾을 수 없음' }, { status: 404 });

    // 대상 학생 ID 수집 (반 + 개별)
    const targetSet = new Set<string>(studentIds ?? []);
    if (classIds && classIds.length > 0) {
      const enrollments = await prisma.classEnrollment.findMany({
        where: { classId: { in: classIds }, isActive: true },
        select: { studentId: true },
      });
      enrollments.forEach((e) => targetSet.add(e.studentId));
    }
    const targets = Array.from(targetSet);
    if (targets.length === 0) {
      return NextResponse.json({ error: '대상 학생이 없습니다.' }, { status: 400 });
    }

    const threshold = typeof passThreshold === 'number' ? passThreshold : template.passThreshold;
    const contexts = await buildPerExamContexts(examId, targets, threshold);
    const sourceBody = typeof overrideBody === 'string' && overrideBody.trim().length > 0
      ? overrideBody
      : template.bodyMarkdown;

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const finalTitle = overrideTitle?.trim() || template.name;
    const created: { studentId: string; reportId: string }[] = [];
    for (const sid of targets) {
      const ctx = contexts.get(sid);
      if (!ctx) continue;
      const renderedBody = renderBody(sourceBody, ctx.context);
      const r = await prisma.report.create({
        data: {
          academyId,
          templateId,
          batchId,
          kind: ReportTemplateKind.PER_EXAM,
          periodLabel: exam.name,
          title: finalTitle,
          summary: summary?.trim() || (ctx.raw.score != null
            ? `${ctx.raw.score}점${ctx.raw.rank != null ? ` · ${ctx.raw.rank}등` : ''}`
            : '점수 미입력'),
          studentId: sid,
          classId: exam.classId,
          examId,
          renderedBody,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: ctx.raw as any,
          publishedBy: userId ?? null,
        },
      });
      created.push({ studentId: sid, reportId: r.id });
    }

    // 푸시 알림 (학생 본인 + 학부모 user의 모든 PushSubscription)
    if (created.length > 0) {
      await sendPushToStudents(created.map((c) => c.studentId), {
        title: '새 리포트가 도착했습니다',
        body: `${exam.name} 결과 리포트를 확인하세요.`,
        url: '/mobile/reports',
        tag: `report-${exam.id}`,
      });
    }

    return NextResponse.json({ ok: true, count: created.length, reports: created });
  } catch (err) {
    console.error('[POST /api/reports/publish]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
