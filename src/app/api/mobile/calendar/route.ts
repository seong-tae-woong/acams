import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CalendarEventType as PrismaType } from '@/generated/prisma/client';
import { resolveStudentId, resolveClassIds } from '@/lib/mobile/resolveStudent';
import { buildMakeupEvents, buildClassScheduleEvents } from '@/lib/calendar/virtualEvents';
import { requireAuth } from '@/lib/auth/requireAuth';

const PRISMA_TO_UI: Record<PrismaType, string> = {
  [PrismaType.ACADEMY_SCHEDULE]: '학원일정',
  [PrismaType.CONSULTATION_SCHEDULE]: '상담일정',
  [PrismaType.MAKEUP_SCHEDULE]: '보강일정',
};

// GET /api/mobile/calendar?year=YYYY&month=MM&studentId=
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10);
  const requestedStudentId = searchParams.get('studentId');

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const classIds = await resolveClassIds(studentId);

    const [events, makeups, classRows] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: {
          academyId,
          date: { gte: from, lt: to },
          OR: [
            { isPublic: true },
            { classId: { in: classIds } },
          ],
        },
        include: {
          class: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
      }),
      // 내 반 보강 또는 내가 보강 대상으로 등록된 보강
      prisma.makeupClass.findMany({
        where: {
          academyId,
          makeupDate: { gte: from, lt: to },
          OR: [
            { originalClassId: { in: classIds } },
            { targets: { some: { studentId } } },
          ],
        },
        include: { originalClass: { select: { name: true } } },
      }),
      // 내가 수강 중인 반의 주간 시간표
      prisma.class.findMany({
        where: { academyId, isActive: true, id: { in: classIds } },
        select: {
          id: true,
          name: true,
          color: true,
          schedules: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true } },
        },
      }),
    ]);

    const result = events.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date.toISOString().slice(0, 10),
      startTime: e.startTime,
      endTime: e.endTime,
      type: PRISMA_TO_UI[e.type],
      isPublic: e.isPublic,
      description: e.description,
      color: e.color,
      classId: e.classId,
      className: e.class?.name ?? null,
    }));

    const makeupEvents = buildMakeupEvents(makeups);
    const classEvents = buildClassScheduleEvents(classRows, year, month);

    return NextResponse.json({ events: [...result, ...makeupEvents, ...classEvents] });
  } catch (err) {
    console.error('[GET /api/mobile/calendar]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
