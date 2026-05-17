import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/finance/bills/months
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const rows = await prisma.bill.findMany({
      where: { academyId },
      select: { month: true },
      distinct: ['month'],
      orderBy: { month: 'desc' },
    });
    return NextResponse.json(rows.map((r) => r.month));
  } catch (err) {
    console.error('[GET /api/finance/bills/months]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
