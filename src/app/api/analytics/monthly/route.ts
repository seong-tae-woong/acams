import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/analytics/monthly — 최근 6개월 수납액 및 재원 학생 수 추이
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 최근 6개월 목록 생성 (YYYY-MM 형식)
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // 월별 수납액: bills.paidAmount 합계 (month 컬럼으로 그룹)
    const bills = await prisma.bill.findMany({
      where: { academyId, month: { in: months } },
      select: { month: true, paidAmount: true },
    });

    const revenueByMonth: Record<string, number> = {};
    for (const b of bills) {
      revenueByMonth[b.month] = (revenueByMonth[b.month] ?? 0) + b.paidAmount;
    }

    // 월별 재원 학생 수: enrollDate 기준 누적 카운트 (enrollDate <= 해당월 말)
    const students = await prisma.student.findMany({
      where: { academyId },
      select: { enrollDate: true, status: true },
    });

    const studentsByMonth: Record<string, number> = {};
    for (const month of months) {
      const [y, m] = month.split('-').map(Number);
      const monthEnd = new Date(y, m, 0); // 해당월 마지막 날
      studentsByMonth[month] = students.filter(
        (s) => new Date(s.enrollDate) <= monthEnd
      ).length;
    }

    const result = months.map((month) => ({
      month: `${parseInt(month.split('-')[1])}월`,
      revenue: revenueByMonth[month] ?? 0,
      students: studentsByMonth[month] ?? 0,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/analytics/monthly]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
