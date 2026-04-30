import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CalendarEventType as PrismaType } from '@/generated/prisma/client';
import type { CalendarEventType } from '@/lib/types/calendar';

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

// PATCH /api/calendar/[id] — 일정 수정
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = req.headers.get('x-user-role');
  if (role !== 'director' && role !== 'teacher' && role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { title, date, startTime, endTime, type, isPublic, description, color, classId, relatedStudentId } = await req.json();

    const prismaType = type ? UI_TO_PRISMA[type as CalendarEventType] : undefined;

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(startTime !== undefined && { startTime: startTime ?? null }),
        ...(endTime !== undefined && { endTime: endTime ?? null }),
        ...(prismaType !== undefined && { type: prismaType }),
        ...(isPublic !== undefined && { isPublic }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(classId !== undefined && { classId: classId ?? null }),
        ...(relatedStudentId !== undefined && { relatedStudentId: relatedStudentId ?? null }),
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
      relatedStudentId: event.relatedStudentId,
    });
  } catch (err) {
    console.error('[PATCH /api/calendar/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/calendar/[id] — 일정 삭제
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = req.headers.get('x-user-role');
  if (role !== 'director' && role !== 'teacher' && role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const event = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!event || event.academyId !== academyId) {
      return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/calendar/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
