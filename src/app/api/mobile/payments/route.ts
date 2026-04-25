import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/mobile/payments
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let studentId: string | null = null;

    if (role === 'student') {
      const s = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true },
      });
      studentId = s?.id ?? null;
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: { student: { select: { id: true } } },
            take: 1,
          },
        },
      });
      studentId = parent?.children[0]?.student.id ?? null;
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const [bills, receipts] = await Promise.all([
      prisma.bill.findMany({
        where: { studentId },
        include: { class: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.receipt.findMany({
        where: { studentId },
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
    console.error('[GET /api/mobile/payments]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
