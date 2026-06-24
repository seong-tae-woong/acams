import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// 요청자가 읽음 처리할 수 있는 학생 id 목록 (학부모 → 자녀, 학생 → 본인).
async function allowedStudentIds(params: { userId: string; role: string; academyId: string }): Promise<string[]> {
  const { userId, role, academyId } = params;
  if (role === 'parent') {
    const parent = await prisma.parent.findFirst({
      where: { userId },
      select: { children: { select: { studentId: true } } },
    });
    return parent?.children.map((c) => c.studentId) ?? [];
  }
  const s = await prisma.student.findFirst({ where: { userId, academyId }, select: { id: true } });
  return s ? [s.id] : [];
}

// POST /api/mobile/notifications/read
//  - 단건: { notificationId, studentId }  → 해당 알림 1건 읽음
//  - 전체: { all: true }                  → 요청자(학부모=모든 자녀)의 안 읽음 전부 읽음
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const allowed = await allowedStudentIds({ userId, role, academyId });
    if (allowed.length === 0) return NextResponse.json({ ok: true, updated: 0 });

    const now = new Date();

    if (body?.all === true) {
      const res = await prisma.notificationRecipient.updateMany({
        where: { studentId: { in: allowed }, readAt: null },
        data: { readAt: now },
      });
      return NextResponse.json({ ok: true, updated: res.count });
    }

    const notificationId = typeof body?.notificationId === 'string' ? body.notificationId : null;
    const studentId = typeof body?.studentId === 'string' ? body.studentId : null;
    if (!notificationId || !studentId) {
      return NextResponse.json({ error: 'notificationId와 studentId가 필요합니다.' }, { status: 400 });
    }
    // 남의 자녀 알림을 읽음 처리하지 못하도록 검증
    if (!allowed.includes(studentId)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const res = await prisma.notificationRecipient.updateMany({
      where: { notificationId, studentId, readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true, updated: res.count });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/mobile/notifications/read]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
