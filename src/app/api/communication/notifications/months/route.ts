import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/communication/notifications/months — sentAt 기준 distinct 월 목록
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.notification.findMany({
      where: { academyId },
      select: { sentAt: true },
      orderBy: { sentAt: 'desc' },
    });
    const toKSTMonth = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const months = [...new Set(rows.map((r) => toKSTMonth(r.sentAt)))].sort((a, b) => b.localeCompare(a));
    return NextResponse.json(months);
  } catch (err) {
    console.error('[GET /api/communication/notifications/months]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
