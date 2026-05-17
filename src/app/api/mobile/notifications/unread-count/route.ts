import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/mobile/notifications/unread-count?studentId=
// studentId 지정 → 해당 학생의 미읽음 (학생 본인이 학부모를 흉내내지 못하도록 resolveStudentId가 검증)
// studentId 미지정 + 학부모 → 모든 자녀의 미읽음 합산 (BottomTabBar 배지용)
// studentId 미지정 + 학생 → 본인의 미읽음
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const requestedStudentId = new URL(req.url).searchParams.get('studentId');

  try {
    // 학부모 + studentId 미지정 → 자녀 전체 합산
    if (role === 'parent' && !requestedStudentId) {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        select: { children: { select: { studentId: true } } },
      });
      const studentIds = parent?.children.map((c) => c.studentId) ?? [];
      if (studentIds.length === 0) return NextResponse.json({ count: 0 });
      const count = await prisma.notificationRecipient.count({
        where: { studentId: { in: studentIds }, readAt: null },
      });
      return NextResponse.json({ count });
    }

    // 그 외(특정 자녀 지정 or 학생) → 단일 학생
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) return NextResponse.json({ count: 0 });

    const count = await prisma.notificationRecipient.count({
      where: { studentId, readAt: null },
    });
    return NextResponse.json({ count });
  } catch (err) {
    console.error('[GET /api/mobile/notifications/unread-count]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ count: 0 });
  }
}
