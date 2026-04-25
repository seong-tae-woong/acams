import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CalendarEventType as PrismaType } from '@/generated/prisma/client';

const PRISMA_TO_UI: Record<PrismaType, string> = {
  [PrismaType.ACADEMY_SCHEDULE]: '학원일정',
  [PrismaType.CONSULTATION_SCHEDULE]: '상담일정',
  [PrismaType.MAKEUP_SCHEDULE]: '보강일정',
};

// GET /api/mobile/calendar?year=YYYY&month=MM
// isPublic=true 이벤트 + 내 반 전용 이벤트 반환
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10);

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  try {
    // 수강 중인 반 목록 조회
    let classIds: string[] = [];

    if (role === 'student') {
      const student = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true },
      });
      if (student) {
        const enrollments = await prisma.classEnrollment.findMany({
          where: { studentId: student.id, isActive: true },
          select: { classId: true },
        });
        classIds = enrollments.map((e) => e.classId);
      }
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: {
              student: {
                include: {
                  classEnrollments: {
                    where: { isActive: true },
                    select: { classId: true },
                  },
                },
              },
            },
          },
        },
      });
      if (parent) {
        classIds = parent.children.flatMap((c) =>
          c.student.classEnrollments.map((e) => e.classId)
        );
      }
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // isPublic=true 또는 내 반 전용 이벤트
    const events = await prisma.calendarEvent.findMany({
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
      classId: e.classId,
      className: e.class?.name ?? null,
    }));

    return NextResponse.json({ events: result });
  } catch (err) {
    console.error('[GET /api/mobile/calendar]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
