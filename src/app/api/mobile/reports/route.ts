import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/mobile/reports?studentId=
// 학생/학부모: 본인 자녀의 발행된 레포트 목록 (최신순)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'student' && role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const requestedStudentId = new URL(req.url).searchParams.get('studentId');
  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) return NextResponse.json({ error: '학생 정보 없음' }, { status: 404 });

    const reports = await prisma.report.findMany({
      where: { academyId, studentId },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true, kind: true, title: true, summary: true,
        periodLabel: true, publishedAt: true, readAt: true,
      },
    });

    const unreadCount = reports.filter((r) => !r.readAt).length;

    return NextResponse.json({
      unreadCount,
      reports: reports.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        summary: r.summary,
        periodLabel: r.periodLabel,
        publishedAt: r.publishedAt.toISOString(),
        unread: !r.readAt,
      })),
    });
  } catch (err) {
    console.error('[GET /api/mobile/reports]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
