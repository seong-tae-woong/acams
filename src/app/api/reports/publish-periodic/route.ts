import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ReportTemplateKind } from '@/generated/prisma/client';
import { renderBody } from '@/lib/reports/tokens';
import { buildPeriodicData } from '@/lib/reports/buildPeriodic';
import { sendPushToStudents } from '@/lib/push/sendPush';
import { requireAuth } from '@/lib/auth/requireAuth';

// POST /api/reports/publish-periodic
// body: { templateId, classIds?: string[], studentIds?: string[], summary?: string }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      templateId, classIds, studentIds, summary,
      overrideBody, overrideTitle, overrideLayout,
      // 직접 작성(양식 없음) 모드 — templateId 없을 때만 사용
      periodMonths: directPeriodMonths,
      passThreshold: directPassThreshold,
      scopeFilter: directScopeFilter,
      bodyMarkdown: directBody,
      title: directTitle,
      layout: directLayout,
    } = body as {
      templateId?: string | null;
      classIds?: string[];
      studentIds?: string[];
      summary?: string;
      overrideBody?: string;
      overrideTitle?: string;
      overrideLayout?: unknown;
      periodMonths?: number;
      passThreshold?: number;
      scopeFilter?: { category1Ids?: string[]; category2Ids?: string[]; category3Ids?: string[] };
      bodyMarkdown?: string;
      title?: string;
      layout?: unknown;
    };

    // 발행 설정 — 양식 모드는 양식에서, 직접 모드는 요청 본문에서 결정
    let resolvedTemplateId: string | null = null;
    let periodMonths: number;
    let scope: Record<string, string[]>;
    let passThreshold: number;
    let baseBody: string;
    let baseTitle: string;
    let baseLayout: unknown;

    if (templateId) {
      const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, academyId } });
      if (!template) return NextResponse.json({ error: '양식 없음' }, { status: 404 });
      if (template.kind !== ReportTemplateKind.PERIODIC || !template.periodMonths) {
        return NextResponse.json({ error: '주기별 양식 + 집계 개월 수 설정 필요' }, { status: 400 });
      }
      resolvedTemplateId = template.id;
      periodMonths = template.periodMonths;
      // 양식을 가져온 경우 카테고리는 양식 값으로 고정 — 요청 본문의 카테고리는 무시(수정 불가)
      scope = (template.scopeFilter as Record<string, string[]>) ?? {};
      passThreshold = template.passThreshold;
      baseBody = template.bodyMarkdown;
      baseTitle = template.name;
      baseLayout = template.layout ?? [];
    } else {
      // 직접 작성 — 양식 없이 발행 화면에서 입력한 값 사용 (카테고리 자유 선택)
      periodMonths = Math.floor(Number(directPeriodMonths));
      if (!periodMonths || periodMonths < 1) {
        return NextResponse.json({ error: '집계 기간(개월)을 입력하세요.' }, { status: 400 });
      }
      scope = {
        category1Ids: Array.isArray(directScopeFilter?.category1Ids) ? directScopeFilter.category1Ids : [],
        category2Ids: Array.isArray(directScopeFilter?.category2Ids) ? directScopeFilter.category2Ids : [],
        category3Ids: Array.isArray(directScopeFilter?.category3Ids) ? directScopeFilter.category3Ids : [],
      };
      passThreshold = typeof directPassThreshold === 'number' ? directPassThreshold : 70;
      baseBody = typeof directBody === 'string' ? directBody : '';
      baseTitle = (typeof directTitle === 'string' && directTitle.trim()) ? directTitle.trim() : '정기 리포트';
      baseLayout = Array.isArray(directLayout) ? directLayout : [];
    }

    // 대상 학생 수집
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
      return NextResponse.json({ error: '대상 학생 없음' }, { status: 400 });
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    // 양식 모드에서 본문/제목/차트를 이번 발행만 수정(override)한 경우 반영. 직접 모드는 base 값이 곧 최종값.
    const sourceBody = typeof overrideBody === 'string' && overrideBody.trim().length > 0
      ? overrideBody
      : baseBody;
    const finalTitle = overrideTitle?.trim() || baseTitle;
    const finalLayout = Array.isArray(overrideLayout) ? overrideLayout : baseLayout;
    const created: { studentId: string; reportId: string }[] = [];
    let periodLabel = '';

    for (const sid of targets) {
      const student = await prisma.student.findUnique({
        where: { id: sid },
        select: { name: true, grade: true, classEnrollments: { where: { isActive: true }, take: 1, include: { class: { select: { id: true, name: true } } } } },
      });
      if (!student) continue;

      const data = await buildPeriodicData(academyId, sid, periodMonths, scope);
      periodLabel = data.period.label;

      const renderedBody = renderBody(sourceBody, {
        학생: student.name,
        학년: student.grade,
        반: student.classEnrollments[0]?.class.name ?? '',
        기간: `${data.period.label} (${data.period.startLabel} ~ ${data.period.endLabel})`,
        대상카테고리: data.categoryLabels.length > 0 ? data.categoryLabels.join(', ') : '전체',
        기간평균: data.averageScore,
        기간최고: data.highestScore,
        기간최저: data.lowestScore,
        기간시험수: data.examCount,
        passThreshold,
      });

      const r = await prisma.report.create({
        data: {
          academyId,
          templateId: resolvedTemplateId,
          batchId,
          kind: ReportTemplateKind.PERIODIC,
          periodLabel: data.period.label,
          title: finalTitle,
          summary: summary?.trim() || (data.averageScore != null
            ? `평균 ${data.averageScore}점 · 시험 ${data.examCount}회`
            : '응시 시험 없음'),
          studentId: sid,
          classId: student.classEnrollments[0]?.class.id ?? null,
          examId: null,
          renderedBody,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: data as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          layout: finalLayout as any,
          publishedBy: userId ?? null,
        },
      });
      created.push({ studentId: sid, reportId: r.id });
    }

    if (created.length > 0) {
      await sendPushToStudents(created.map((c) => c.studentId), {
        title: '새 정기 리포트가 도착했습니다',
        body: `${periodLabel} 리포트를 확인하세요.`,
        url: '/mobile/reports',
        tag: `report-periodic-${periodLabel}`,
      });
    }

    return NextResponse.json({ ok: true, count: created.length, periodLabel, reports: created });
  } catch (err) {
    console.error('[POST /api/reports/publish-periodic]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
