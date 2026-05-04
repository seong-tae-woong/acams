import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/finance/bills/months
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.bill.findMany({
      where: { academyId },
      select: { month: true },
      distinct: ['month'],
      orderBy: { month: 'desc' },
    });
    return NextResponse.json(rows.map((r) => r.month));
  } catch (err) {
    console.error('[GET /api/finance/bills/months]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
