import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/mobile/announcements
// 본인 반(classId) 공지 + 전체 공지(classId=null) 반환
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // classId=null(전체) 또는 내 반에 해당하는 PUBLISHED 공지
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
