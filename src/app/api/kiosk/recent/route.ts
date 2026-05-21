import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyKioskToken } from '@/lib/kiosk/token';

export async function GET(req: NextRequest) {
  // x-kiosk-token 헤더 검증 — academyId를 외부 입력(query string)으로 신뢰하지 않음
  const token = req.headers.get('x-kiosk-token');
  if (!token) {
    return NextResponse.json({ error: 'x-kiosk-token required' }, { status: 401 });
  }

  let academyId: string;
  try {
    ({ academyId } = await verifyKioskToken(token));
  } catch {
    return NextResponse.json({ error: 'Invalid or expired kiosk token' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get('since');

  const sinceDate = since ? new Date(since) : new Date(Date.now() - 10 * 60 * 1000);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      academyId,
      checkedAt: { gt: sinceDate },
      status: { in: ['PRESENT', 'LATE'] },
    },
    include: {
      student: { select: { name: true } },
      class: { select: { name: true } },
    },
    orderBy: { checkedAt: 'desc' },
    take: 5,
  });

  return NextResponse.json({
    checkIns: records.map((r) => ({
      id: r.id,
      studentName: r.student.name,
      className: r.class.name,
      checkInTime: r.checkInTime,
      status: r.status,
      checkedAt: r.checkedAt.toISOString(),
    })),
  });
}
