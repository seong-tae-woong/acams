import { NextRequest, NextResponse } from 'next/server';
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

type MakeupForMap = {
  id: string; originalClassId: string; originalDate: Date;
  makeupDate: Date; makeupTime: string; teacherId: string;
  reason: string; attendanceChecked: boolean;
  slotType: MakeupSlotType;
  capacity: number | null;
  applicationDeadline: Date | null;
  recurrenceGroupId: string | null;
  originalClass: { name: string };
  teacher: { name: string };
  targets: { studentId: string; status: PrismaStatus | null; memo: string }[];
};

function mapMakeup(m: MakeupForMap) {
  return {
    id: m.id,
    originalClassId: m.originalClassId,
    originalClassName: m.originalClass.name,
    originalDate: m.originalDate.toISOString().slice(0, 10),
    makeupDate: m.makeupDate.toISOString().slice(0, 10),
    makeupTime: m.makeupTime,
    teacherId: m.teacherId,
    teacherName: m.teacher.name,
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

    return NextResponse.json({
      items: items.map(mapMakeup),
      nextCursor,
    });
  } catch (err) {
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
    } = body;

    if (!originalClassId || !teacherId) {
      return NextResponse.json({ error: '원래 반, 강사는 필수입니다.' }, { status: 400 });
    }

    const isOpen = slotType === 'OPEN';
    const slotEnum = isOpen ? MakeupSlotType.OPEN : MakeupSlotType.PERSONAL;

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
            : (() => {
                // 기본: 시작 시각 1시간 전
                const [hh, mm] = pattern.startTime.split(':').map(Number);
                const d = new Date(dateObj);
                d.setUTCHours(hh - 1, mm, 0, 0);
                return d;
              })();
          const m = await tx.makeupClass.create({
            data: {
              academyId,
              originalClassId,
              originalDate: dateObj, // 반복 슬롯은 originalDate=makeupDate로
              makeupDate: dateObj,
              makeupTime: pattern.startTime + (pattern.endTime ? `~${pattern.endTime}` : ''),
              teacherId,
              reason: reason ?? '정기 보강',
              attendanceChecked: false,
              slotType: slotEnum,
              capacity: typeof capacity === 'number' && capacity > 0 ? capacity : null,
              applicationDeadline: deadline,
              recurrenceGroupId: groupId,
              recurrencePattern: pattern as object,
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
      return NextResponse.json(
        {
          ...mapMakeup(first!),
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
          : (() => {
              const [hh, mm] = (makeupTime || '00:00').split(':').map(Number);
              const d = new Date(dateObj);
              d.setUTCHours(hh - 1, mm, 0, 0);
              return d;
            })())
      : null;

    const makeup = await prisma.$transaction(async (tx) => {
      const m = await tx.makeupClass.create({
        data: {
          academyId,
          originalClassId,
          originalDate: new Date(originalDate ?? makeupDate),
          makeupDate: dateObj,
          makeupTime: makeupTime ?? '',
          teacherId,
          reason: reason ?? '',
          attendanceChecked: false,
          slotType: slotEnum,
          capacity: isOpen && typeof capacity === 'number' && capacity > 0 ? capacity : null,
          applicationDeadline: deadline,
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

    return NextResponse.json(mapMakeup(created!), { status: 201 });
  } catch (err) {
    console.error('[POST /api/makeup]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
