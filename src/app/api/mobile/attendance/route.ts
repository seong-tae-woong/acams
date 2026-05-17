import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/mobile/attendance?month=YYYY-MM&studentId=
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

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

    // 보강 출결을 학부모/학생 앱에도 노출
    const makeups = await prisma.makeupClass.findMany({
      where: {
        academyId,
        ...(dateFilter ? { makeupDate: dateFilter } : {}),
        targets: { some: { studentId, status: { not: null } } },
      },
      include: {
        originalClass: { select: { name: true } },
        targets: {
          where: { studentId, status: { not: null } },
          select: { status: true },
        },
      },
    });

    const makeupMapped = makeups.flatMap((m) =>
      m.targets.map((t) => ({
        id: `makeup-${m.id}-${studentId}`,
        date: m.makeupDate.toISOString().slice(0, 10),
        status: t.status ?? 'PRESENT',
        className: `${m.originalClass.name} (보강)`,
        classId: m.originalClassId,
      })),
    );

    return NextResponse.json({
      records: [
        ...records.map((r) => ({
          id: r.id,
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
          className: r.class.name,
          classId: r.classId,
        })),
        ...makeupMapped,
      ],
    });
  } catch (err) {
    console.error('[GET /api/mobile/attendance]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
