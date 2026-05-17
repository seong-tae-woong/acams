import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

const CLASS_INCLUDE = {
  teachers: {
    where: { isPrimary: true },
    include: { teacher: { select: { id: true, name: true } } },
    take: 1,
  },
  enrollments: { where: { isActive: true }, select: { studentId: true } },
  schedules: { select: { dayOfWeek: true, startTime: true, endTime: true } },
} as const;

function mapClass(c: {
  id: string; name: string; subject: string; level: string;
  color: string; room: string; fee: number; feeType: string; maxStudents: number;
  description: string;
  curriculumPalette: string;
  teachers: { teacherId: string; teacher: { id: string; name: string } }[];
  enrollments: { studentId: string }[];
  schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
}) {
  const primaryTeacher = c.teachers[0];
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    level: c.level,
    teacherId: primaryTeacher?.teacher.id ?? '',
    teacherName: primaryTeacher?.teacher.name ?? '',
    maxStudents: c.maxStudents,
    currentStudents: c.enrollments.length,
    students: c.enrollments.map((e) => e.studentId),
    schedule: c.schedules.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    color: c.color,
    room: c.room,
    fee: c.fee,
    feeType: c.feeType as 'monthly' | 'weekly' | 'per-lesson',
    description: c.description,
    curriculumPalette: (c.curriculumPalette as 'red' | 'orange' | 'green' | 'custom') ?? 'green',
  };
}

// GET /api/classes
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const classes = await prisma.class.findMany({
      where: { academyId, isActive: true },
      include: CLASS_INCLUDE,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(classes.map(mapClass));
  } catch (err) {
    console.error('[GET /api/classes]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/classes
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const body = await req.json();
    const { name, subject, level, teacherId, maxStudents, schedule, color, room, fee, feeType, description } = body;

    if (!name) return NextResponse.json({ error: '반 이름은 필수입니다.' }, { status: 400 });

    const cls = await prisma.$transaction(async (tx) => {
      const created = await tx.class.create({
        data: {
          academyId,
          name,
          subject: subject ?? '',
          level: level ?? '',
          color: color ?? '#4fc3a1',
          room: room ?? '',
          fee: fee ?? 0,
          feeType: feeType ?? 'monthly',
          maxStudents: maxStudents ?? 10,
          description: description ?? '',
        },
      });

      if (teacherId) {
        await tx.classTeacher.create({
          data: { classId: created.id, teacherId, isPrimary: true },
        });
      }

      if (Array.isArray(schedule)) {
        await tx.classSchedule.createMany({
          data: schedule.map((s: { dayOfWeek: number; startTime: string; endTime: string }) => ({
            classId: created.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }

      return created.id;
    });

    const created = await prisma.class.findUnique({
      where: { id: cls },
      include: CLASS_INCLUDE,
    });

    return NextResponse.json(mapClass(created!), { status: 201 });
  } catch (err) {
    console.error('[POST /api/classes]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
