import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { ReportTemplateKind } from '@/generated/prisma/client';
import { renderBody } from '@/lib/reports/tokens';
import { buildDailyContexts, formatDateLabel, hasDailyData, type DailyRaw } from '@/lib/reports/buildDailyContext';
import { sendPushToStudents } from '@/lib/push/sendPush';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { Prisma } from '@/generated/prisma/client';

// 비우면 그날 데이터로 짧은 요약 자동 생성 (PWA 리스트용)
function autoSummary(raw: DailyRaw): string {
  const parts: string[] = [];
  if (raw.attitude != null) parts.push(`태도 ${raw.attitude}점`);
  if (raw.homeworkDone === true) parts.push('과제 완료');
  else if (raw.homeworkDone === false) parts.push('과제 미완료');
  if (raw.examName && raw.examScore != null) parts.push(`${raw.examName} ${raw.examScore}점`);
  if (parts.length > 0) return parts.join(' · ');
  if (raw.sessionNote && raw.sessionNote.trim()) return raw.sessionNote.trim().slice(0, 30);
  return '수업 기록';
}

// POST /api/reports/publish-daily
// body: { templateId, classId, date(YYYY-MM-DD), classIds?, studentIds?, passThreshold?, summary?, overrideBody?, overrideTitle? }
//   - classIds(반 전체) 또는 studentIds(개별) 중 하나 이상
//   - 그날 데이터 없는 학생은 스킵, 대상 전원이 비면 422 (plan-eng-review D3)
//   - Report는 createMany로 1회 삽입 (D4 — 교차리전 왕복 최소화)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { templateId, classId, date, classIds, studentIds, passThreshold, summary, overrideBody, overrideTitle } = body as {
      templateId: string;
      classId: string;
      date: string;
      classIds?: string[];
      studentIds?: string[];
      passThreshold?: number;
      summary?: string;
      overrideBody?: string;
      overrideTitle?: string;
    };

    if (!templateId || !classId || !date) {
      return NextResponse.json({ error: 'templateId, classId, date 필수' }, { status: 400 });
    }

    const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, academyId } });
    if (!template) return NextResponse.json({ error: '양식을 찾을 수 없음' }, { status: 404 });
    if (template.kind !== ReportTemplateKind.DAILY) {
      return NextResponse.json({ error: '수업(데일리) 양식만 사용 가능' }, { status: 400 });
    }

    const cls = await prisma.class.findFirst({ where: { id: classId, academyId }, select: { id: true } });
    if (!cls) return NextResponse.json({ error: '반을 찾을 수 없음' }, { status: 404 });

    // 대상 학생 수집 (반 전체 + 개별)
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
    const contexts = await buildDailyContexts(academyId, classId, date, targets, threshold);
    const sourceBody = typeof overrideBody === 'string' && overrideBody.trim().length > 0
      ? overrideBody
      : template.bodyMarkdown;
    const finalTitle = overrideTitle?.trim() || template.name;
    const periodLabel = formatDateLabel(date);

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const rows: Prisma.ReportCreateManyInput[] = [];
    let skipped = 0;
    for (const sid of targets) {
      const ctx = contexts.get(sid);
      // 그날 데이터가 전혀 없는 학생은 빈 리포트 방지 위해 스킵 (D3)
      if (!ctx || !hasDailyData(ctx.raw)) {
        skipped++;
        continue;
      }
      rows.push({
        academyId,
        templateId,
        batchId,
        kind: ReportTemplateKind.DAILY,
        periodLabel,
        title: finalTitle,
        summary: summary?.trim() || autoSummary(ctx.raw),
        studentId: sid,
        classId,
        renderedBody: renderBody(sourceBody, ctx.context),
        data: ctx.raw as unknown as Prisma.InputJsonValue,
        publishedBy: userId ?? null,
      });
    }

    // 대상 전원이 빈 경우 (그날 어떤 학생도 데이터 없음)
    if (rows.length === 0) {
      return NextResponse.json(
        { error: '선택한 날짜에 발행할 수업 데이터가 없습니다.', skipped },
        { status: 422 },
      );
    }

    await prisma.report.createMany({ data: rows });

    const sentStudentIds = rows.map((r) => r.studentId);
    await sendPushToStudents(sentStudentIds, {
      title: '새 리포트가 도착했습니다',
      body: `${periodLabel} 수업 리포트를 확인하세요.`,
      url: '/mobile/reports',
      tag: `daily-${classId}-${date}`,
    });

    return NextResponse.json({ ok: true, count: rows.length, skipped });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/reports/publish-daily]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
