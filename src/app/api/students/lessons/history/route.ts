import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import type {
  StudentLessonHistory,
  StudentLessonClinicSummary,
  StudentLessonTimelineEntry,
  StudentLessonTimelineClinic,
  ClinicCheck,
  ClinicTemplateItem,
} from '@/lib/types/lesson';

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// GET /api/students/lessons/history?studentId=&classId=&from=&to=
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const classIdParam = searchParams.get('classId') || undefined;
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  if (!studentId || !fromStr || !toStr) {
    return NextResponse.json({ error: 'studentId, from, to 필수' }, { status: 400 });
  }

  try {
    // 1. 학생 검증 (멀티테넌트)
    const student = await prisma.student.findFirst({
      where: { id: studentId, academyId },
      include: {
        classEnrollments: {
          where: { isActive: true },
          include: { class: { select: { id: true, name: true, color: true } } },
        },
      },
    });
    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없음' }, { status: 404 });
    }

    const studentClassIds = student.classEnrollments.map((e) => e.classId);
    if (studentClassIds.length === 0) {
      return NextResponse.json({
        student: { id: student.id, name: student.name },
        range: { from: fromStr, to: toStr },
        classes: [],
        summary: { commentCount: 0, clinicByTemplate: [] },
        timeline: [],
      } satisfies StudentLessonHistory);
    }

    // 2. classId 옵션 적용 (지정 시 학생 소속 반인지 검증)
    let targetClassIds: string[];
    if (classIdParam) {
      if (!studentClassIds.includes(classIdParam)) {
        return NextResponse.json({ error: '해당 반에 속하지 않은 학생' }, { status: 403 });
      }
      targetClassIds = [classIdParam];
    } else {
      targetClassIds = studentClassIds;
    }

    const from = toDateOnly(fromStr);
    const to = toDateOnly(toStr);

    // 3. Comment + ClinicResult 병렬 조회
    const [comments, clinicResults, templates, classRows] = await Promise.all([
      prisma.lessonComment.findMany({
        where: {
          academyId,
          studentId,
          classId: { in: targetClassIds },
          sessionDate: { gte: from, lte: to },
        },
        include: { class: { select: { id: true, name: true, color: true } } },
      }),
      prisma.clinicResult.findMany({
        where: {
          academyId,
          studentId,
          classId: { in: targetClassIds },
          sessionDate: { gte: from, lte: to },
        },
        include: { class: { select: { id: true, name: true, color: true } } },
      }),
      prisma.clinicTemplate.findMany({ where: { academyId } }),
      prisma.class.findMany({
        where: { academyId, id: { in: targetClassIds } },
        include: { schedules: true },
      }),
    ]);

    const classMap = new Map(classRows.map((c) => [c.id, c]));
    const templateMap = new Map(templates.map((t) => [t.id, t]));

    // 4. 양식별 체크율 요약 계산
    const summaryAgg = new Map<
      string,
      { templateName: string; isActive: boolean; itemTotals: Map<string, { label: string; total: number; checked: number }> }
    >();

    for (const r of clinicResults) {
      const tmpl = templateMap.get(r.templateId);
      const tmplName = tmpl?.name ?? '(삭제된 양식)';
      const tmplActive = tmpl?.isActive ?? false;
      const tmplItems = (tmpl?.items as unknown as ClinicTemplateItem[] | null) ?? [];
      const itemLabelMap = new Map(tmplItems.map((it) => [it.id, it.label]));

      let agg = summaryAgg.get(r.templateId);
      if (!agg) {
        agg = { templateName: tmplName, isActive: tmplActive, itemTotals: new Map() };
        summaryAgg.set(r.templateId, agg);
      }

      const checks = (r.checks as unknown as ClinicCheck[] | null) ?? [];
      for (const c of checks) {
        const label = itemLabelMap.get(c.itemId) ?? '(삭제된 항목)';
        let entry = agg.itemTotals.get(c.itemId);
        if (!entry) {
          entry = { label, total: 0, checked: 0 };
          agg.itemTotals.set(c.itemId, entry);
        }
        entry.total += 1;
        if (c.checked) entry.checked += 1;
      }
    }

    const clinicByTemplate: StudentLessonClinicSummary[] = [];
    for (const [templateId, agg] of summaryAgg.entries()) {
      const itemRates = [...agg.itemTotals.entries()].map(([itemId, v]) => ({
        itemId,
        label: v.label,
        total: v.total,
        checked: v.checked,
        rate: v.total > 0 ? v.checked / v.total : 0,
      }));
      clinicByTemplate.push({
        templateId,
        templateName: agg.templateName,
        isActive: agg.isActive,
        itemRates,
      });
    }
    clinicByTemplate.sort((a, b) => a.templateName.localeCompare(b.templateName));

    // 5. 타임라인 빌드 — (classId, sessionDate) 키로 코멘트와 Clinic 묶기
    type Key = string; // `${classId}|${YYYY-MM-DD}`
    const timelineMap = new Map<
      Key,
      {
        date: string;
        classId: string;
        comment: string | null;
        clinicsByTemplate: Map<string, StudentLessonTimelineClinic>;
      }
    >();

    const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

    for (const c of comments) {
      const date = dateOnly(c.sessionDate);
      const key = `${c.classId}|${date}`;
      timelineMap.set(key, {
        date,
        classId: c.classId,
        comment: c.comment,
        clinicsByTemplate: new Map(),
      });
    }

    for (const r of clinicResults) {
      const date = dateOnly(r.sessionDate);
      const key = `${r.classId}|${date}`;
      let entry = timelineMap.get(key);
      if (!entry) {
        entry = { date, classId: r.classId, comment: null, clinicsByTemplate: new Map() };
        timelineMap.set(key, entry);
      }
      const tmpl = templateMap.get(r.templateId);
      const tmplName = tmpl?.name ?? '(삭제된 양식)';
      const tmplActive = tmpl?.isActive ?? false;
      const tmplItems = (tmpl?.items as unknown as ClinicTemplateItem[] | null) ?? [];
      const itemLabelMap = new Map(tmplItems.map((it) => [it.id, it.label]));
      const checks = (r.checks as unknown as ClinicCheck[] | null) ?? [];
      entry.clinicsByTemplate.set(r.templateId, {
        templateId: r.templateId,
        templateName: tmplName,
        isActive: tmplActive,
        checks: checks.map((c) => ({
          itemId: c.itemId,
          label: itemLabelMap.get(c.itemId) ?? '(삭제된 항목)',
          checked: c.checked,
        })),
      });
    }

    // 6. 각 entry에 수업 시간 정보 매칭 (ClassSchedule 기반, 요일 매칭)
    const timeline: StudentLessonTimelineEntry[] = [];
    for (const e of timelineMap.values()) {
      const cls = classMap.get(e.classId);
      const dateObj = new Date(`${e.date}T00:00:00.000Z`);
      const jsDay = dateObj.getUTCDay();
      const dow = jsDay === 0 ? 7 : jsDay;
      const sched = cls?.schedules.find((s) => s.dayOfWeek === dow);

      timeline.push({
        date: e.date,
        classId: e.classId,
        className: cls?.name ?? '(삭제된 반)',
        classColor: cls?.color ?? '#9ca3af',
        startTime: sched?.startTime ?? '',
        endTime: sched?.endTime ?? '',
        isOneTime: !sched, // 정규 일정에 없으면 보강으로 간주
        comment: e.comment,
        clinics: [...e.clinicsByTemplate.values()],
      });
    }

    timeline.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date); // 최신순
      return b.startTime.localeCompare(a.startTime);
    });

    // 7. 응답 조립
    const classesRef = student.classEnrollments.map((e) => ({
      id: e.class.id,
      name: e.class.name,
      color: e.class.color,
    }));

    const result: StudentLessonHistory = {
      student: { id: student.id, name: student.name },
      range: { from: fromStr, to: toStr },
      classes: classesRef,
      summary: {
        commentCount: comments.filter((c) => c.comment.trim() !== '').length,
        clinicByTemplate,
      },
      timeline,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/students/lessons/history]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
