import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/communication/inquiries?month=YYYY-MM — 원장/강사용 상담 신청 목록
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = new URL(req.url).searchParams.get('month');
  const monthFilter = month
    ? { createdAt: { gte: new Date(`${month}-01`), lt: new Date(`${month.slice(0, 4)}-${String(parseInt(month.slice(5, 7)) + 1).padStart(2, '0')}-01`) } }
    : {};

  try {
    const inquiries = await prisma.publicInquiry.findMany({
      where: { academyId, ...monthFilter },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      inquiries.map((inq) => ({
        id:        inq.id,
        name:      inq.name,
        phone:     inq.phone,
        classId:   inq.classId,
        className: inq.className,
        message:   inq.message,
        status:    inq.status,   // 'NEW' | 'READ' | 'REPLIED'
        memo:      inq.memo,
        createdAt: inq.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    console.error('[GET /api/communication/inquiries]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
