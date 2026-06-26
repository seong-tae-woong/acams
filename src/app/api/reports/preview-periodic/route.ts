import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { ReportTemplateKind } from '@/generated/prisma/client';
import { renderBody } from '@/lib/reports/tokens';
import { buildPeriodicData } from '@/lib/reports/buildPeriodic';
import { formatDateLabelShort } from '@/lib/reports/buildDailyContext';
import { requireAuth } from '@/lib/auth/requireAuth';

// POST /api/reports/preview-periodic
// body: { templateId, studentId }
// → { renderedBody, layout, data }
//   - DB write 없이 발행 시점 기준 데이터를 미리 계산
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const {
      templateId, studentId, bodyMarkdown,
      periodMonths: directPeriodMonths,
      passThreshold: directPassThreshold,
      scopeFilter: directScopeFilter,
    } = await req.json();
    if (!studentId) {
      return NextResponse.json({ error: 'studentId 필수' }, { status: 400 });
    }

    // 양식 모드는 양식에서, 직접 모드는 요청 본문에서 집계 설정 결정
    let periodMonths: number;
    let scope: Record<string, string[]>;
    let passThreshold: number;
    let baseBody: string;
    let templateLayout: unknown = [];

    if (templateId) {
      const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, academyId } });
      if (!template) return NextResponse.json({ error: '양식 없음' }, { status: 404 });
      if (template.kind !== ReportTemplateKind.PERIODIC || !template.periodMonths) {
        return NextResponse.json({ error: '기간 양식 + 집계 개월 수 필요' }, { status: 400 });
      }
      periodMonths = template.periodMonths;
      scope = (template.scopeFilter as Record<string, string[]>) ?? {};
      passThreshold = template.passThreshold;
      baseBody = template.bodyMarkdown;
      templateLayout = template.layout;
    } else {
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
      baseBody = '';
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, academyId },
      select: {
        name: true, grade: true,
        classEnrollments: {
          where: { isActive: true }, take: 1,
          include: { class: { select: { name: true } } },
        },
      },
    });
    if (!student) return NextResponse.json({ error: '학생 정보 없음' }, { status: 404 });

    const data = await buildPeriodicData(academyId, studentId, periodMonths, scope);

    const sourceBody = typeof bodyMarkdown === 'string' ? bodyMarkdown : baseBody;
    const renderedBody = renderBody(sourceBody, {
      학생: student.name,
      학년: student.grade,
      반: student.classEnrollments[0]?.class.name ?? '',
      기간: `${data.period.label} (${data.period.startLabel} ~ ${data.period.endLabel})`,
      월일: formatDateLabelShort(data.period.endLabel),
      대상카테고리: data.categoryLabels.length > 0 ? data.categoryLabels.join(', ') : '전체',
      기간평균: data.averageScore,
      기간최고: data.highestScore,
      기간최저: data.lowestScore,
      기간시험수: data.examCount,
      passThreshold,
    });

    return NextResponse.json({
      renderedBody,
      layout: templateLayout,
      data,
      studentName: student.name,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/reports/preview-periodic]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
