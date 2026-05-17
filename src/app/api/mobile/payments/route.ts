import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/mobile/payments?studentId=
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const requestedStudentId = new URL(req.url).searchParams.get('studentId');

  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const [bills, receipts] = await Promise.all([
      prisma.bill.findMany({
        where: {
          studentId,
          academyId,
          status: { not: 'CANCELLED' }, // 취소된 청구서는 모바일에 미노출
        },
        include: { class: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.receipt.findMany({
        where: { studentId, cancelledAt: null }, // 취소된 영수증 미노출
        orderBy: { issuedDate: 'desc' },
      }),
    ]);

    return NextResponse.json({
      bills: bills.map((b) => ({
        id: b.id,
        className: b.class.name,
        month: b.month,
        amount: b.amount,
        paidAmount: b.paidAmount,
        status: b.status,
        dueDate: b.dueDate.toISOString().slice(0, 10),
        memo: b.memo,
      })),
      receipts: receipts.map((r) => ({
        id: r.id,
        amount: r.amount,
        issuedDate: r.issuedDate.toISOString().slice(0, 10),
        method: r.method,
      })),
    });
  } catch (err) {
    console.error('[GET /api/mobile/payments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
