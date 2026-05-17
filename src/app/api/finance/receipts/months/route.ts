import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/finance/receipts/months — issuedDate 기준 distinct 월 목록
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const rows = await prisma.receipt.findMany({
      where: { bill: { academyId } },
      select: { issuedDate: true },
      orderBy: { issuedDate: 'desc' },
    });
    const months = [...new Set(rows.map((r) => r.issuedDate.toISOString().slice(0, 7)))].sort((a, b) => b.localeCompare(a));
    return NextResponse.json(months);
  } catch (err) {
    console.error('[GET /api/finance/receipts/months]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
