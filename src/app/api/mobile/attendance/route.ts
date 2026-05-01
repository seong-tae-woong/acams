import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';

// GET /api/mobile/attendance?month=YYYY-MM&studentId=
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

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const requestedStudentId = searchParams.get('studentId');

  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
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
