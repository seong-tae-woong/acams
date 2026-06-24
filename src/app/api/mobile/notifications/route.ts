import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

const PAGE_SIZE = 10;

const TYPE_TO_UI: Record<string, string> = {
  ANNOUNCEMENT: '공지',
  ATTENDANCE_ALERT: '출결알림',
  PAYMENT_ALERT: '수납알림',
  CONSULTATION_ALERT: '상담알림',
  GENERAL: '일반',
};

// 요청자(학부모/학생)가 알림을 받을 수 있는 학생 목록 + 이름 맵을 구한다.
// 학부모 → 모든 자녀(통합 피드), 학생 → 본인.
async function resolveRecipients(params: { userId: string; role: string; academyId: string }) {
  const { userId, role, academyId } = params;
  const nameById = new Map<string, string>();

  if (role === 'parent') {
    const parent = await prisma.parent.findFirst({
      where: { userId },
      include: { children: { include: { student: { select: { id: true, name: true } } } } },
    });
    for (const c of parent?.children ?? []) {
      nameById.set(c.student.id, c.student.name);
    }
    return { studentIds: [...nameById.keys()], nameById };
  }

  // student
  const s = await prisma.student.findFirst({
    where: { userId, academyId },
    select: { id: true, name: true },
  });
  if (s) nameById.set(s.id, s.name);
  return { studentIds: s ? [s.id] : [], nameById };
}

// GET /api/mobile/notifications?page=1
// 학부모: 모든 자녀의 알림을 sentAt 기준 병합해 페이지네이션. 읽음 처리는 하지 않음
// (읽음은 POST /api/mobile/notifications/read 로 알림별 처리).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  try {
    const { studentIds, nameById } = await resolveRecipients({ userId, role, academyId });
    if (studentIds.length === 0) {
      return NextResponse.json({ notifications: [], hasMore: false, page, total: 0 });
    }

    const total = await prisma.notificationRecipient.count({
      where: { studentId: { in: studentIds } },
    });

    const recipients = await prisma.notificationRecipient.findMany({
      where: { studentId: { in: studentIds } },
      include: { notification: true },
      orderBy: { notification: { sentAt: 'desc' } },
      skip,
      take: PAGE_SIZE,
    });

    const result = recipients.map((r) => {
      const meta = r.notification.metadata as { billIds?: string[] } | null;
      return {
        id: r.notification.id,
        studentId: r.studentId,
        studentName: nameById.get(r.studentId) ?? '',
        type: TYPE_TO_UI[r.notification.type] ?? '일반',
        title: r.notification.title,
        content: r.notification.content,
        sentAt: r.notification.sentAt.toISOString(),
        readAt: r.readAt ? r.readAt.toISOString() : null,
        billIds: meta?.billIds ?? [],
      };
    });

    const hasMore = skip + recipients.length < total;

    return NextResponse.json({ notifications: result, hasMore, page, total });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/mobile/notifications]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
