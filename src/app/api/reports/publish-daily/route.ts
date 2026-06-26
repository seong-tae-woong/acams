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
// body: { templateId, date(YYYY-MM-DD), targets:[{classId, studentIds?}], examIds?, passThreshold?, summary?, overrideBody?, overrideTitle? }
//   - targets: 반별 대상. studentIds 생략 시 그 반 활성 학생 전체(반 단위), 지정 시 개별
//   - examIds: 그날 시험 중 포함할 시험(사용자 선택). 생략 시 그날 전체. 반별로 해당 반 시험만 자동 적용
//   - 그날 데이터 없는 학생은 스킵, 대상 전원이 비면 422 (plan-eng-review D3)
//   - 여러 반이어도 한 배치(batchId)로 묶어 Report createMany 1회 (D4 — 교차리전 왕복 최소화)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { templateId, date, targets, examIds, passThreshold, summary, overrideBody, overrideTitle } = body as {
      templateId: string;
      date: string;
      targets?: Array<{ classId: string; studentIds?: string[] }>;
      examIds?: string[];
      passThreshold?: number;
      summary?: string;
      overrideBody?: string;
      overrideTitle?: string;
    };

    if (!templateId || !date || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ error: 'templateId, date, targets 필수' }, { status: 400 });
    }

    const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, academyId } });
    if (!template) return NextResponse.json({ error: '양식을 찾을 수 없음' }, { status: 404 });
    if (template.kind !== ReportTemplateKind.DAILY) {
      return NextResponse.json({ error: '수업(데일리) 양식만 사용 가능' }, { status: 400 });
    }

    // 학원 소속 반만 허용
    const reqClassIds = [...new Set(targets.map((t) => t.classId).filter(Boolean))];
    const validClasses = await prisma.class.findMany({
      where: { id: { in: reqClassIds }, academyId },
      select: { id: true },
    });
    const validSet = new Set(validClasses.map((c) => c.id));

    const examIdsArr = Array.isArray(examIds) ? (examIds as string[]) : undefined;
    const threshold = typeof passThreshold === 'number' ? passThreshold : template.passThreshold;
    const sourceBody = typeof overrideBody === 'string' && overrideBody.trim().length > 0
      ? overrideBody
      : template.bodyMarkdown;
    const finalTitle = overrideTitle?.trim() || template.name;
    const periodLabel = formatDateLabel(date);

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const rows: Prisma.ReportCreateManyInput[] = [];
    let skipped = 0;

    // 반별로 대상 학생 확정 → 반 단위 컨텍스트 빌드 (반별 시험·수업내용이 달라 반마다 별도 빌드)
    for (const t of targets) {
      if (!validSet.has(t.classId)) continue;
      let students = Array.isArray(t.studentIds) ? t.studentIds.filter(Boolean) : [];
      if (students.length === 0) {
        const enr = await prisma.classEnrollment.findMany({
          where: { classId: t.classId, isActive: true },
          select: { studentId: true },
        });
        students = enr.map((e) => e.studentId);
      }
      if (students.length === 0) continue;

      const contexts = await buildDailyContexts(academyId, t.classId, date, students, threshold, examIdsArr);
      for (const sid of students) {
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
          classId: t.classId,
          renderedBody: renderBody(sourceBody, ctx.context),
          data: ctx.raw as unknown as Prisma.InputJsonValue,
          publishedBy: userId ?? null,
        });
      }
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
      tag: `daily-${batchId}`,
    });

    return NextResponse.json({ ok: true, count: rows.length, skipped });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/reports/publish-daily]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
