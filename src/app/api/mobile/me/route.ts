import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';

// GET /api/mobile/me?studentId=
// role=student → 본인 프로필 + 수강 반
// role=parent  → 지정 자녀(또는 첫 번째 자녀) 프로필 + 수강 반
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const requestedStudentId = new URL(req.url).searchParams.get('studentId');

  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        school: true,
        grade: true,
        phone: true,
        avatarColor: true,
        attendanceNumber: true,
        qrCode: true,
        parentLinks: {
          include: { parent: { select: { name: true, phone: true } } },
          take: 1,
        },
        classEnrollments: {
          where: { isActive: true },
          include: {
            class: {
              select: {
                id: true,
                name: true,
                subject: true,
                color: true,
                room: true,
                schedules: {
                  select: { dayOfWeek: true, startTime: true, endTime: true },
                },
                teachers: {
                  where: { isPrimary: true },
                  include: { teacher: { select: { name: true } } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const firstParent = student.parentLinks[0]?.parent;

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        school: student.school,
        grade: student.grade,
        phone: student.phone,
        avatarColor: student.avatarColor,
        attendanceNumber: student.attendanceNumber,
        qrCode: student.qrCode,
        parentName: firstParent?.name ?? null,
        parentPhone: firstParent?.phone ?? null,
      },
      classes: student.classEnrollments.map((e) => ({
        id: e.class.id,
        name: e.class.name,
        subject: e.class.subject,
        color: e.class.color,
        room: e.class.room,
        teacherName: e.class.teachers[0]?.teacher.name ?? '',
        schedule: e.class.schedules,
      })),
    });
  } catch (err) {
    console.error('[GET /api/mobile/me]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
