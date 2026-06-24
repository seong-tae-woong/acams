import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { AttendanceStatus as PrismaStatus, MakeupSlotType } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';
import { randomUUID } from 'crypto';

const STATUS_TO_UI: Record<PrismaStatus, '출석' | '결석' | '지각' | '조퇴'> = {
  [PrismaStatus.PRESENT]: '출석',
  [PrismaStatus.ABSENT]: '결석',
  [PrismaStatus.LATE]: '지각',
  [PrismaStatus.EARLY_LEAVE]: '조퇴',
};

const MAKEUP_INCLUDE = {
  originalClass: { select: { name: true } },
  teacher: { select: { name: true } },
  targets: { select: { studentId: true, status: true, memo: true } },
} as const;

function asIdArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [];
}

// eligibleClassIds / teacherIds(Json)의 이름 해석 맵 — 한 페이지 분량을 일괄 조회 (N+1 방지)
async function buildMakeupNameMaps(items: { eligibleClassIds: unknown; teacherIds: unknown }[]) {
  const classIds = new Set<string>();
  const teacherIds = new Set<string>();
  for (const it of items) {
    asIdArray(it.eligibleClassIds).forEach((id) => classIds.add(id));
    asIdArray(it.teacherIds).forEach((id) => teacherIds.add(id));
  }
  const [cls, tch] = await Promise.all([
    classIds.size ? prisma.class.findMany({ where: { id: { in: [...classIds] } }, select: { id: true, name: true } }) : Promise.resolve([]),
    teacherIds.size ? prisma.teacher.findMany({ where: { id: { in: [...teacherIds] } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  return {
    classNames: new Map(cls.map((c) => [c.id, c.name])),
    teacherNames: new Map(tch.map((t) => [t.id, t.name])),
  };
}

type MakeupForMap = {
  id: string; originalClassId: string; originalDate: Date;
  makeupDate: Date; makeupTime: string; teacherId: string | null;
  reason: string; attendanceChecked: boolean;
  slotType: MakeupSlotType;
  capacity: number | null;
  applicationDeadline: Date | null;
  recurrenceGroupId: string | null;
  openToAllClasses: boolean;
  eligibleClassIds: unknown;
  teacherIds: unknown;
  originalClass: { name: string };
  teacher: { name: string } | null;
  targets: { studentId: string; status: PrismaStatus | null; memo: string }[];
};

function mapMakeup(
  m: MakeupForMap,
  classNames?: Map<string, string>,
  teacherNames?: Map<string, string>,
) {
  const eligibleClassIds = asIdArray(m.eligibleClassIds);
  const teacherIds = asIdArray(m.teacherIds);
  return {
    id: m.id,
    originalClassId: m.originalClassId,
    originalClassName: m.originalClass.name,
    originalDate: m.originalDate.toISOString().slice(0, 10),
    makeupDate: m.makeupDate.toISOString().slice(0, 10),
    makeupTime: m.makeupTime,
    teacherId: m.teacherId ?? '',
    teacherName: m.teacher?.name ?? '',
    targetStudents: m.targets.map((t) => t.studentId),
    attendance: m.targets.map((t) => ({
      studentId: t.studentId,
      status: t.status ? STATUS_TO_UI[t.status] : null,
      memo: t.memo,
    })),
    reason: m.reason,
    attendanceChecked: m.attendanceChecked,
    slotType: m.slotType,
    capacity: m.capacity,
    applicationDeadline: m.applicationDeadline ? m.applicationDeadline.toISOString() : null,
    recurrenceGroupId: m.recurrenceGroupId,
    // ── 오픈 보강 다중 대상 ──
    openToAllClasses: m.openToAllClasses,
    eligibleClassIds,
    eligibleClassNames: eligibleClassIds.map((id) => classNames?.get(id)).filter((n): n is string => !!n),
    teacherIds,
    teacherNames: teacherIds.map((id) => teacherNames?.get(id)).filter((n): n is string => !!n),
    // 신청 가능 인원 계산은 UI에서 capacity - targets.length로
  };
}

// GET /api/makeup?slotType=PERSONAL|OPEN&classId=&from=YYYY-MM-DD&to=YYYY-MM-DD&cursor=YYYY-MM-DD|id&limit=10
// 응답: { items: MakeupClass[], nextCursor: string | null }
// 정렬: makeupDate DESC, id DESC (안정 정렬을 위해 id를 tie-breaker로 사용)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const cursor = searchParams.get('cursor');
  const limitParam = searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 50);

  const slotTypeParam = searchParams.get('slotType');
  const slotType =
    slotTypeParam === 'OPEN' ? MakeupSlotType.OPEN :
    slotTypeParam === 'PERSONAL' ? MakeupSlotType.PERSONAL :
    undefined;

  // cursor: "YYYY-MM-DD|<id>" — makeupDate가 이보다 작거나, 같으면 id가 더 작은 row
  let cursorDate: Date | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    const [d, id] = cursor.split('|');
    if (d && id && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      cursorDate = new Date(`${d}T00:00:00.000Z`);
      cursorId = id;
    }
  }

  const dateRange: { gte?: Date; lte?: Date } = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    dateRange.gte = new Date(`${from}T00:00:00.000Z`);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    dateRange.lte = new Date(`${to}T23:59:59.999Z`);
  }

  try {
    const makeups = await prisma.makeupClass.findMany({
      where: {
        academyId,
        ...(classId ? { originalClassId: classId } : {}),
        ...(slotType ? { slotType } : {}),
        ...(Object.keys(dateRange).length > 0 ? { makeupDate: dateRange } : {}),
        ...(cursorDate && cursorId
          ? {
              OR: [
                { makeupDate: { lt: cursorDate } },
                { makeupDate: cursorDate, id: { lt: cursorId } },
              ],
            }
          : {}),
      },
      include: MAKEUP_INCLUDE,
      orderBy: [{ makeupDate: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = makeups.length > limit;
    const items = hasMore ? makeups.slice(0, limit) : makeups;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? `${last.makeupDate.toISOString().slice(0, 10)}|${last.id}`
      : null;

    const { classNames, teacherNames } = await buildMakeupNameMaps(items);
    return NextResponse.json({
      items: items.map((m) => mapMakeup(m, classNames, teacherNames)),
      nextCursor,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/makeup]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

interface RecurrencePattern {
  daysOfWeek: number[];   // 1=월..7=일
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  startTime: string;      // HH:MM
  endTime?: string;       // HH:MM (옵션, 정보용)
}

// 오픈 보강 신청 마감 = 보강 시작 시각 − leadHours (학원 설정). startTime은 "HH:MM" 또는 "HH:MM~HH:MM".
function computeDeadline(dateObj: Date, startTime: string, leadHours: number): Date {
  const clean = (startTime || '00:00').split('~')[0];
  const [hh, mm] = clean.split(':').map(Number);
  const startDt = new Date(dateObj);
  startDt.setUTCHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return new Date(startDt.getTime() - leadHours * 3600_000);
}

// 반복 패턴 → makeupDate 목록 펼침
function expandRecurrence(p: RecurrencePattern): string[] {
  const start = new Date(`${p.startDate}T00:00:00.000Z`);
  const end = new Date(`${p.endDate}T00:00:00.000Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
  const targetDows = new Set(p.daysOfWeek);
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const jsDow = d.getUTCDay();
    const dow = jsDow === 0 ? 7 : jsDow;
    if (targetDows.has(dow)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}

// POST /api/makeup
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      originalClassId,
      originalDate,
      makeupDate,
      makeupTime,
      teacherId,
      reason,
      targetStudents,
      slotType,
      capacity,
      applicationDeadline,
      recurrencePattern,
      // 오픈 보강 다중 대상
      openToAllClasses,
      eligibleClassIds,
      teacherIds,
    } = body;

    const isOpen = slotType === 'OPEN';
    const slotEnum = isOpen ? MakeupSlotType.OPEN : MakeupSlotType.PERSONAL;

    // ── 대표 반/강사 + 다중 대상 산정 ──
    // 개별 보강(PERSONAL): 단일 반·강사 필수. 오픈 보강(OPEN): 여러 반/전체 반 + 강사 0..N(선택).
    let repClassId: string;
    let repTeacherId: string | null = null;
    let eligibleForDb: string[] = [];
    let teachersForDb: string[] = [];
    let allClassesForDb = false;

    if (isOpen) {
      let eligible = [...new Set(asIdArray(eligibleClassIds))];
      let teachers = [...new Set(asIdArray(teacherIds))];
      allClassesForDb = !!openToAllClasses;
      // body의 id는 신뢰 금지 — 학원 소속만 통과
      if (eligible.length > 0) {
        const valid = await prisma.class.findMany({ where: { id: { in: eligible }, academyId }, select: { id: true } });
        const vs = new Set(valid.map((c) => c.id));
        eligible = eligible.filter((id) => vs.has(id));
      }
      if (teachers.length > 0) {
        const validT = await prisma.teacher.findMany({ where: { id: { in: teachers }, academyId }, select: { id: true } });
        const vt = new Set(validT.map((t) => t.id));
        teachers = teachers.filter((id) => vt.has(id));
      }
      if (!allClassesForDb && eligible.length === 0) {
        return NextResponse.json({ error: '대상 반을 선택하거나 전체 반을 지정해주세요.' }, { status: 400 });
      }
      if (allClassesForDb) {
        const firstClass = await prisma.class.findFirst({ where: { academyId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (!firstClass) return NextResponse.json({ error: '학원에 등록된 반이 없습니다.' }, { status: 400 });
        repClassId = firstClass.id;
        eligibleForDb = [];
      } else {
        repClassId = eligible[0];
        eligibleForDb = eligible;
      }
      teachersForDb = teachers;
      repTeacherId = teachers[0] ?? null;
    } else {
      if (!originalClassId || !teacherId) {
        return NextResponse.json({ error: '원래 반, 강사는 필수입니다.' }, { status: 400 });
      }
      repClassId = originalClassId;
      repTeacherId = teacherId;
    }

    // 오픈 보강 기본 신청 마감 리드타임 (학원 설정, 기본 24h = 1일 전)
    const academySettings = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { openMakeupApplyLeadHours: true },
    });
    const leadHours = academySettings?.openMakeupApplyLeadHours ?? 24;

    // ── 반복 슬롯 (OPEN 전용) ──
    if (isOpen && recurrencePattern) {
      const pattern = recurrencePattern as RecurrencePattern;
      if (!Array.isArray(pattern.daysOfWeek) || pattern.daysOfWeek.length === 0) {
        return NextResponse.json({ error: '반복 요일을 선택해주세요.' }, { status: 400 });
      }
      if (!pattern.startDate || !pattern.endDate || !pattern.startTime) {
        return NextResponse.json({ error: '반복 시작일·종료일·시작 시간을 입력해주세요.' }, { status: 400 });
      }
      const rawDates = expandRecurrence(pattern);
      if (rawDates.length === 0) {
        return NextResponse.json({ error: '생성될 슬롯이 없습니다. 기간을 확인해주세요.' }, { status: 400 });
      }

      // 휴원일 자동 제외 — 같은 학원의 CLOSED_DAY 이벤트와 겹치는 날짜는 스킵
      const closedEvents = await prisma.calendarEvent.findMany({
        where: {
          academyId,
          type: 'CLOSED_DAY',
          date: {
            gte: new Date(`${pattern.startDate}T00:00:00.000Z`),
            lte: new Date(`${pattern.endDate}T23:59:59.999Z`),
          },
        },
        select: { date: true },
      });
      const closedSet = new Set(closedEvents.map((e) => e.date.toISOString().slice(0, 10)));
      const dates = rawDates.filter((d) => !closedSet.has(d));
      const excludedDates = rawDates.filter((d) => closedSet.has(d));

      if (dates.length === 0) {
        return NextResponse.json(
          { error: '선택한 기간이 모두 휴원일이라 생성된 슬롯이 없습니다.', excludedDates },
          { status: 400 },
        );
      }
      if (dates.length > 200) {
        return NextResponse.json({ error: '반복 슬롯이 너무 많습니다 (최대 200개).' }, { status: 400 });
      }

      const groupId = randomUUID();
      const createdIds = await prisma.$transaction(async (tx) => {
        const ids: string[] = [];
        for (const date of dates) {
          const dateObj = new Date(`${date}T00:00:00.000Z`);
          const deadline = applicationDeadline
            ? new Date(applicationDeadline)
            : computeDeadline(dateObj, pattern.startTime, leadHours);
          const m = await tx.makeupClass.create({
            data: {
              academyId,
              originalClassId: repClassId,
              originalDate: dateObj, // 반복 슬롯은 originalDate=makeupDate로
              makeupDate: dateObj,
              makeupTime: pattern.startTime + (pattern.endTime ? `~${pattern.endTime}` : ''),
              teacherId: repTeacherId,
              reason: reason ?? '정기 보강',
              attendanceChecked: false,
              slotType: slotEnum,
              capacity: typeof capacity === 'number' && capacity > 0 ? capacity : null,
              applicationDeadline: deadline,
              recurrenceGroupId: groupId,
              recurrencePattern: pattern as object,
              openToAllClasses: allClassesForDb,
              eligibleClassIds: eligibleForDb,
              teacherIds: teachersForDb,
            },
          });
          ids.push(m.id);
        }
        return ids;
      });

      // 첫 슬롯만 반환 (목록 갱신은 클라이언트가 refetch)
      const first = await prisma.makeupClass.findUnique({
        where: { id: createdIds[0] },
        include: MAKEUP_INCLUDE,
      });
      const firstMaps = await buildMakeupNameMaps([first!]);
      return NextResponse.json(
        {
          ...mapMakeup(first!, firstMaps.classNames, firstMaps.teacherNames),
          createdCount: createdIds.length,
          excludedCount: excludedDates.length,
          excludedDates,
        },
        { status: 201 },
      );
    }

    // ── 단일 슬롯 (PERSONAL 또는 OPEN-단일) ──
    if (!makeupDate) {
      return NextResponse.json({ error: '보강일은 필수입니다.' }, { status: 400 });
    }
    if (!isOpen && !originalDate) {
      return NextResponse.json({ error: '개별 보강은 원래 수업일이 필수입니다.' }, { status: 400 });
    }

    const dateObj = new Date(makeupDate);
    const deadline = isOpen
      ? (applicationDeadline
          ? new Date(applicationDeadline)
          : computeDeadline(dateObj, makeupTime || '00:00', leadHours))
      : null;

    const makeup = await prisma.$transaction(async (tx) => {
      const m = await tx.makeupClass.create({
        data: {
          academyId,
          originalClassId: repClassId,
          originalDate: new Date(originalDate ?? makeupDate),
          makeupDate: dateObj,
          makeupTime: makeupTime ?? '',
          teacherId: repTeacherId,
          reason: reason ?? '',
          attendanceChecked: false,
          slotType: slotEnum,
          capacity: isOpen && typeof capacity === 'number' && capacity > 0 ? capacity : null,
          applicationDeadline: deadline,
          openToAllClasses: allClassesForDb,
          eligibleClassIds: eligibleForDb,
          teacherIds: teachersForDb,
        },
      });

      if (Array.isArray(targetStudents) && targetStudents.length > 0) {
        await tx.makeupClassTarget.createMany({
          data: targetStudents.map((studentId: string) => ({
            makeupClassId: m.id,
            studentId,
          })),
          skipDuplicates: true,
        });
      }

      return m.id;
    });

    const created = await prisma.makeupClass.findUnique({
      where: { id: makeup },
      include: MAKEUP_INCLUDE,
    });
    const createdMaps = await buildMakeupNameMaps([created!]);

    return NextResponse.json(mapMakeup(created!, createdMaps.classNames, createdMaps.teacherNames), { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/makeup]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
