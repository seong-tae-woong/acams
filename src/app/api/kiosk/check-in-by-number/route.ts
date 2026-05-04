import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

async function resolveAcademy(param: string) {
  return prisma.academy.findFirst({
    where: { OR: [{ id: param }, { slug: param }], isActive: true },
    select: { id: true, name: true },
  });
}

// GET: 출결번호로 학생 조회 (확인 단계)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const attendanceNumber = searchParams.get('attendanceNumber')?.trim();
  const param = searchParams.get('academy') ?? searchParams.get('academyId');

  if (!attendanceNumber || !param) {
    return NextResponse.json({ error: '출결번호와 학원 정보가 필요합니다.' }, { status: 400 });
  }

  const academy = await resolveAcademy(param);
  if (!academy) {
    return NextResponse.json({ error: '학원 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const student = await prisma.student.findFirst({
    where: { attendanceNumber, academyId: academy.id },
    select: { id: true, name: true },
  });

  if (!student) {
    return NextResponse.json({ error: '출결번호에 해당하는 학생을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ studentId: student.id, studentName: student.name });
}

// POST: 출결번호로 출석 체크
export async function POST(req: NextRequest) {
  let body: { attendanceNumber?: string; academy?: string; academyId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const attendanceNumber = body.attendanceNumber?.trim();
  const param = body.academy ?? body.academyId;

  if (!attendanceNumber || !param) {
    return NextResponse.json({ error: '출결번호와 학원 정보가 필요합니다.' }, { status: 400 });
  }

  const academy = await resolveAcademy(param);
  if (!academy) {
    return NextResponse.json({ error: '학원 정보를 찾을 수 없습니다.' }, { status: 404 });
  }

  const student = await prisma.student.findFirst({
    where: { attendanceNumber, academyId: academy.id },
    include: {
      classEnrollments: {
        where: { isActive: true },
        include: {
          class: { include: { schedules: true } },
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: '출결번호에 해당하는 학생을 찾을 수 없습니다.' }, { status: 404 });
  }

  const now = new Date();
  const todayDow = now.getDay() || 7;
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const checkInTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const todayOptions = student.classEnrollments
    .filter((e) => e.class?.isActive)
    .flatMap((e) =>
      e.class.schedules
        .filter((s) => s.dayOfWeek === todayDow)
        .map((s) => ({ cls: e.class, schedule: s }))
    )
    .sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));

  if (todayOptions.length === 0) {
    return NextResponse.json({ error: '오늘 수업이 없습니다.' }, { status: 400 });
  }

  const activeOption =
    todayOptions.find(({ schedule }) => {
      const [h, m] = schedule.startTime.split(':').map(Number);
      const startMin = h * 60 + m;
      return nowMinutes >= startMin - 30 && nowMinutes <= startMin + 90;
    }) ?? todayOptions[0];

  const dateObj = new Date(todayStr);

  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      studentId_classId_date: {
        studentId: student.id,
        classId: activeOption.cls.id,
        date: dateObj,
      },
    },
  });

  if (existing) {
    return NextResponse.json({
      success: true,
      alreadyChecked: true,
      studentName: student.name,
      className: activeOption.cls.name,
      checkInTime: existing.checkInTime ?? checkInTime,
      status: existing.status,
    });
  }

  const [sh, sm] = activeOption.schedule.startTime.split(':').map(Number);
  const status = nowMinutes > sh * 60 + sm + 10 ? 'LATE' : 'PRESENT';

  await prisma.attendanceRecord.create({
    data: {
      academyId: academy.id,
      studentId: student.id,
      classId: activeOption.cls.id,
      date: dateObj,
      status,
      checkInTime,
      checkedAt: now,
    },
  });

  return NextResponse.json({
    success: true,
    alreadyChecked: false,
    studentName: student.name,
    className: activeOption.cls.name,
    checkInTime,
    status,
  });
}
