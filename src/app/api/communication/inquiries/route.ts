import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/communication/inquiries — 원장/강사용 상담 신청 목록
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const inquiries = await prisma.publicInquiry.findMany({
      where: { academyId },
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
