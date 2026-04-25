import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/mobile/attendance?month=YYYY-MM
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // YYYY-MM

  try {
    let studentId: string | null = null;

    if (role === 'student') {
      const s = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true },
      });
      studentId = s?.id ?? null;
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: { student: { select: { id: true } } },
            take: 1,
          },
        },
      });
      studentId = parent?.children[0]?.student.id ?? null;
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const dateFilter = month
      ? (() => {
          const [y, m] = month.split('-').map(Number);
          return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
        })()
      : undefined;

    const records = await prisma.attendanceRecord.findMany({
      where: {
        academyId,
        studentId,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: { class: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({
      records: records.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
        className: r.class.name,
        classId: r.classId,
      })),
    });
  } catch (err) {
    console.error('[GET /api/mobile/attendance]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
