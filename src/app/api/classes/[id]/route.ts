import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

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
  color: string; room: string; fee: number; maxStudents: number;
  description: string;
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
    feeType: 'monthly' as const,
    description: c.description,
  };
}

// PATCH /api/classes/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const { name, subject, level, teacherId, maxStudents, schedule, color, room, fee, description } = body;

    await prisma.$transaction(async (tx) => {
      await tx.class.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(subject !== undefined && { subject }),
          ...(level !== undefined && { level }),
          ...(color !== undefined && { color }),
          ...(room !== undefined && { room }),
          ...(fee !== undefined && { fee }),
          ...(maxStudents !== undefined && { maxStudents }),
          ...(description !== undefined && { description }),
        },
      });

      if (teacherId !== undefined) {
        await tx.classTeacher.deleteMany({ where: { classId: id } });
        if (teacherId) {
          await tx.classTeacher.create({
            data: { classId: id, teacherId, isPrimary: true },
          });
        }
      }

      if (Array.isArray(schedule)) {
        await tx.classSchedule.deleteMany({ where: { classId: id } });
        await tx.classSchedule.createMany({
          data: schedule.map((s: { dayOfWeek: number; startTime: string; endTime: string }) => ({
            classId: id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }
    });

    const updated = await prisma.class.findUnique({
      where: { id },
      include: CLASS_INCLUDE,
    });

    return NextResponse.json(mapClass(updated!));
  } catch (err) {
    console.error('[PATCH /api/classes/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/classes/[id] — soft delete (isActive = false)
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.class.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/classes/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
