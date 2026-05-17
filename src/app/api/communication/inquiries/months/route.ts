import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/communication/inquiries/months — createdAt 기준 distinct 월 목록
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const rows = await prisma.publicInquiry.findMany({
      where: { academyId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const toKSTMonth = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const months = [...new Set(rows.map((r) => toKSTMonth(r.createdAt)))].sort((a, b) => b.localeCompare(a));
    return NextResponse.json(months);
  } catch (err) {
    console.error('[GET /api/communication/inquiries/months]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
