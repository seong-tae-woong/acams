import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CalendarEventType as PrismaType } from '@/generated/prisma/client';
import type { CalendarEventType } from '@/lib/types/calendar';

// UI 문자열 ↔ Prisma enum 변환
const UI_TO_PRISMA: Record<CalendarEventType, PrismaType> = {
  '학원일정': PrismaType.ACADEMY_SCHEDULE,
  '상담일정': PrismaType.CONSULTATION_SCHEDULE,
  '보강일정': PrismaType.MAKEUP_SCHEDULE,
};

const PRISMA_TO_UI: Record<PrismaType, CalendarEventType> = {
  [PrismaType.ACADEMY_SCHEDULE]: '학원일정',
  [PrismaType.CONSULTATION_SCHEDULE]: '상담일정',
  [PrismaType.MAKEUP_SCHEDULE]: '보강일정',
};

const TYPE_COLOR: Record<CalendarEventType, string> = {
  '학원일정': '#4fc3a1',
  '상담일정': '#6366f1',
  '보강일정': '#8b5cf6',
};

// GET /api/calendar?year=YYYY&month=MM — 해당 월 이벤트 목록
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10); // 1-indexed

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1); // exclusive

  try {
    const events = await prisma.calendarEvent.findMany({
      where: {
        academyId,
        date: { gte: from, lt: to },
      },
      orderBy: { date: 'asc' },
    });

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
      relatedStudentId: null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/calendar]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/calendar — 일정 생성
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = req.headers.get('x-user-role');
  if (role !== 'director' && role !== 'teacher' && role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  try {
    const { title, date, startTime, endTime, type, isPublic, description, color, classId } = await req.json();

    if (!title || !date || !type) {
      return NextResponse.json({ error: '제목, 날짜, 일정 종류는 필수입니다.' }, { status: 400 });
    }

    const prismaType = UI_TO_PRISMA[type as CalendarEventType];
    if (!prismaType) {
      return NextResponse.json({ error: '유효하지 않은 일정 종류입니다.' }, { status: 400 });
    }

    const resolvedColor = color ?? TYPE_COLOR[type as CalendarEventType] ?? '#4fc3a1';

    const event = await prisma.calendarEvent.create({
      data: {
        academyId,
        title,
        date: new Date(date),
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        type: prismaType,
        isPublic: isPublic ?? true,
        description: description ?? '',
        color: resolvedColor,
        classId: classId ?? null,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      id: event.id,
      title: event.title,
      date: event.date.toISOString().slice(0, 10),
      startTime: event.startTime,
      endTime: event.endTime,
      type: PRISMA_TO_UI[event.type],
      isPublic: event.isPublic,
      description: event.description,
      color: event.color,
      classId: event.classId,
      className: event.class?.name ?? null,
      relatedStudentId: null,
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/calendar]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
