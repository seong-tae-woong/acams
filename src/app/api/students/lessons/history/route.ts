import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import type {
  StudentLessonHistory,
  StudentLessonClinicSummary,
  StudentLessonTimelineEntry,
  StudentLessonTimelineClinic,
  ClinicCheck,
  ClinicCustomItem,
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

    // 3. Comment + ClinicResult + 보강 데이터 병렬 조회
    const [comments, clinicResults, makeupComments, makeupClinicResults, makeupTargets, templates, classRows] = await Promise.all([
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
      // 보강 코멘트 — 학생이 명단에 있는 보강만
      prisma.makeupComment.findMany({
        where: {
          academyId,
          studentId,
          makeupClass: {
            originalClassId: { in: targetClassIds },
            makeupDate: { gte: from, lte: to },
          },
        },
        include: {
          makeupClass: {
            select: {
              id: true,
              originalClassId: true,
              makeupDate: true,
              makeupTime: true,
              reason: true,
              originalClass: { select: { id: true, name: true, color: true } },
            },
          },
        },
      }),
      // 보강 Clinic 결과 — 학생이 명단에 있는 보강만
      prisma.makeupClinicResult.findMany({
        where: {
          academyId,
          studentId,
          makeupClass: {
            originalClassId: { in: targetClassIds },
            makeupDate: { gte: from, lte: to },
          },
        },
        include: {
          makeupClass: {
            select: {
              id: true,
              originalClassId: true,
              makeupDate: true,
              makeupTime: true,
              reason: true,
              originalClass: { select: { id: true, name: true, color: true } },
            },
          },
        },
      }),
      // 보강 명단에 있는 모든 보강 (코멘트/Clinic이 없어도 타임라인에 표시)
      prisma.makeupClassTarget.findMany({
        where: {
          studentId,
          makeupClass: {
            academyId,
            originalClassId: { in: targetClassIds },
            makeupDate: { gte: from, lte: to },
          },
        },
        include: {
          makeupClass: {
            select: {
              id: true,
              originalClassId: true,
              makeupDate: true,
              makeupTime: true,
              reason: true,
              originalClass: { select: { id: true, name: true, color: true } },
            },
          },
        },
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

    // 정규 + 보강 Clinic 결과를 함께 집계
    const aggregateClinic = (r: {
      templateId: string;
      checks: unknown;
      hiddenItemIds: unknown;
    }) => {
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

      const hiddenIds = new Set((r.hiddenItemIds as unknown as string[] | null) ?? []);
      const checks = (r.checks as unknown as ClinicCheck[] | null) ?? [];
      for (const c of checks) {
        if (hiddenIds.has(c.itemId)) continue;
        const label = itemLabelMap.get(c.itemId) ?? '(삭제된 항목)';
        let entry = agg.itemTotals.get(c.itemId);
        if (!entry) {
          entry = { label, total: 0, checked: 0 };
          agg.itemTotals.set(c.itemId, entry);
        }
        entry.total += 1;
        if (c.checked) entry.checked += 1;
      }
    };

    for (const r of clinicResults) aggregateClinic(r);
    for (const r of makeupClinicResults) aggregateClinic(r);

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
      const customItems = (r.customItems as unknown as ClinicCustomItem[] | null) ?? [];
      const hiddenIds = new Set((r.hiddenItemIds as unknown as string[] | null) ?? []);
      const templateChecks = checks
        .filter((c) => !hiddenIds.has(c.itemId))
        .map((c) => ({
          itemId: c.itemId,
          label: itemLabelMap.get(c.itemId) ?? '(삭제된 항목)',
          checked: c.checked,
          source: 'template' as const,
        }));
      const customChecks = customItems.map((ci) => ({
        itemId: ci.id,
        label: ci.label,
        checked: ci.checked,
        source: 'custom' as const,
      }));
      entry.clinicsByTemplate.set(r.templateId, {
        templateId: r.templateId,
        templateName: tmplName,
        isActive: tmplActive,
        checks: [...templateChecks, ...customChecks],
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
        makeupClassId: null,
        makeupReason: null,
      });
    }

    // 6-b. 보강 세션을 별도 timeline entry로 추가 (makeupClassId 키)
    type MakeupEntry = {
      makeupClassId: string;
      date: string;
      time: string;
      classId: string;
      className: string;
      classColor: string;
      reason: string;
      comment: string | null;
      clinicsByTemplate: Map<string, StudentLessonTimelineClinic>;
    };
    const makeupMap = new Map<string, MakeupEntry>();

    const ensureMakeupEntry = (mc: {
      id: string;
      originalClassId: string;
      makeupDate: Date;
      makeupTime: string;
      reason: string;
      originalClass: { id: string; name: string; color: string };
    }) => {
      let entry = makeupMap.get(mc.id);
      if (!entry) {
        entry = {
          makeupClassId: mc.id,
          date: dateOnly(mc.makeupDate),
          time: mc.makeupTime,
          classId: mc.originalClassId,
          className: mc.originalClass.name,
          classColor: mc.originalClass.color,
          reason: mc.reason,
          comment: null,
          clinicsByTemplate: new Map(),
        };
        makeupMap.set(mc.id, entry);
      }
      return entry;
    };

    // 보강 대상으로 등록된 모든 보강 (코멘트/Clinic 없어도 표시)
    for (const t of makeupTargets) ensureMakeupEntry(t.makeupClass);
    for (const c of makeupComments) {
      const entry = ensureMakeupEntry(c.makeupClass);
      entry.comment = c.comment;
    }
    for (const r of makeupClinicResults) {
      const entry = ensureMakeupEntry(r.makeupClass);
      const tmpl = templateMap.get(r.templateId);
      const tmplName = tmpl?.name ?? '(삭제된 양식)';
      const tmplActive = tmpl?.isActive ?? false;
      const tmplItems = (tmpl?.items as unknown as ClinicTemplateItem[] | null) ?? [];
      const itemLabelMap = new Map(tmplItems.map((it) => [it.id, it.label]));
      const checks = (r.checks as unknown as ClinicCheck[] | null) ?? [];
      const customItems = (r.customItems as unknown as ClinicCustomItem[] | null) ?? [];
      const hiddenIds = new Set((r.hiddenItemIds as unknown as string[] | null) ?? []);
      const templateChecks = checks
        .filter((c) => !hiddenIds.has(c.itemId))
        .map((c) => ({
          itemId: c.itemId,
          label: itemLabelMap.get(c.itemId) ?? '(삭제된 항목)',
          checked: c.checked,
          source: 'template' as const,
        }));
      const customChecks = customItems.map((ci) => ({
        itemId: ci.id,
        label: ci.label,
        checked: ci.checked,
        source: 'custom' as const,
      }));
      entry.clinicsByTemplate.set(r.templateId, {
        templateId: r.templateId,
        templateName: tmplName,
        isActive: tmplActive,
        checks: [...templateChecks, ...customChecks],
      });
    }

    for (const m of makeupMap.values()) {
      // 보강 시간을 HH:MM~HH:MM 형식으로 — endTime은 없으므로 빈값 유지
      timeline.push({
        date: m.date,
        classId: m.classId,
        className: m.className,
        classColor: m.classColor,
        startTime: m.time,
        endTime: '',
        isOneTime: true,
        comment: m.comment,
        clinics: [...m.clinicsByTemplate.values()],
        makeupClassId: m.makeupClassId,
        makeupReason: m.reason,
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
        commentCount:
          comments.filter((c) => c.comment.trim() !== '').length +
          makeupComments.filter((c) => c.comment.trim() !== '').length,
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
