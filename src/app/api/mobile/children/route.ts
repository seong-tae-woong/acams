import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/mobile/children
// parent → 모든 자녀 목록, student → 본인 정보 1건
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (role === 'student') {
      const student = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true, name: true, avatarColor: true },
      });
      return NextResponse.json({
        role: 'student',
        children: student
          ? [{ id: student.id, name: student.name, avatarColor: student.avatarColor }]
          : [],
      });
    }

    if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: {
              student: { select: { id: true, name: true, avatarColor: true } },
            },
          },
        },
      });
      const children =
        parent?.children.map((c) => ({
          id: c.student.id,
          name: c.student.name,
          avatarColor: c.student.avatarColor,
        })) ?? [];
      return NextResponse.json({ role: 'parent', children });
    }

    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  } catch (err) {
    console.error('[GET /api/mobile/children]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
