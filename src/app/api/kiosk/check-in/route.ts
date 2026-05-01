import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyKioskToken } from '@/lib/kiosk/token';

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!userId || role !== 'student') {
    return NextResponse.json({ error: '학생만 출석 체크할 수 있습니다.' }, { status: 403 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  if (!body.token) {
    return NextResponse.json({ error: 'QR 토큰이 없습니다.' }, { status: 400 });
  }

  let kioskAcademyId: string;
  try {
    const payload = await verifyKioskToken(body.token);
    kioskAcademyId = payload.academyId;
  } catch {
    return NextResponse.json({ error: 'QR 코드가 만료되었거나 유효하지 않습니다.' }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { userId, academyId: kioskAcademyId },
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
    return NextResponse.json({ error: '이 학원 소속 학생이 아닙니다.' }, { status: 403 });
  }

  const now = new Date();
  const todayDow = now.getDay() || 7; // 1=월 ... 7=일
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const checkInTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 오늘 수업 중 현재 시간 기준 가장 가까운 반 선택 (시작 30분 전 ~ 시작 90분 후)
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
      academyId: kioskAcademyId,
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
