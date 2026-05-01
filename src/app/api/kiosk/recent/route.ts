import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const academyId = searchParams.get('academyId');
  const since = searchParams.get('since');

  if (!academyId) {
    return NextResponse.json({ error: 'academyId required' }, { status: 400 });
  }

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
