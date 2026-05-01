import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId, resolveClassIds } from '@/lib/mobile/resolveStudent';

// GET /api/mobile/announcements?studentId=
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

    const classIds = await resolveClassIds(studentId);

    const announcements = await prisma.announcement.findMany({
      where: {
        academyId,
        status: 'PUBLISHED',
        OR: [
          { classId: null },
          { classId: { in: classIds } },
        ],
      },
      include: {
        class: { select: { id: true, name: true } },
      },
      orderBy: [
        { pinned: 'desc' },
        { publishedAt: 'desc' },
      ],
    });

    const result = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      pinned: a.pinned,
      publishedAt: a.publishedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      classId: a.classId,
      className: a.class?.name ?? null,
    }));

    return NextResponse.json({ announcements: result });
  } catch (err) {
    console.error('[GET /api/mobile/announcements]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
