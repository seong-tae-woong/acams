import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS } from '@/generated/prisma/client';
import { calcInitialPerLessonAmount } from '@/lib/utils/billing';

// POST /api/finance/bills/generate
// body: { month: "YYYY-MM", dueDate?: "YYYY-MM-DD" }
// 활성 수강생 전체 대상으로 해당 월 청구서 일괄 생성·갱신
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { month, dueDate: bodyDueDate } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month(YYYY-MM)은 필수입니다.' }, { status: 400 });
    }

    const dueDate = bodyDueDate ?? `${month}-25`;

    const enrollments = await prisma.classEnrollment.findMany({
      where: { isActive: true, class: { academyId } },
      select: {
        studentId: true,
        classId: true,
        class: { select: { feeType: true, fee: true } },
      },
    });

    let created = 0;
    const refreshed = 0; // 더 이상 자동 재계산 없음 (재청구 흐름으로 분리)

    for (const enr of enrollments) {
      // 이미 활성(미납/부분납/완납) 청구서가 있으면 생성 건너뜀
      // CANCELLED 청구서는 카운트하지 않음 — 재청구 흐름으로 별도 처리
      const existing = await prisma.bill.findFirst({
        where: {
          studentId: enr.studentId,
          classId: enr.classId,
          month,
          status: { not: PrismaBS.CANCELLED },
        },
        select: { id: true },
      });

      if (existing) {
        // 이미 존재: 생성 건너뜀 (기존 청구서는 건드리지 않음 — 재계산은 출결이 아닌 재청구 흐름)
        continue;
      }

      // 신규 생성 — 스케줄 기반으로만 금액 산정 (출결 미반영)
      let amount: number;
      let scheduledCount: number | null = null;

      if (enr.class.feeType === 'per-lesson') {
        const calc = await calcInitialPerLessonAmount(enr.classId, month);
        amount = calc.amount;
        scheduledCount = calc.scheduledCount;
      } else {
        amount = enr.class.fee;
      }

      await prisma.bill.create({
        data: {
          academyId,
          studentId: enr.studentId,
          classId: enr.classId,
          month,
          amount,
          paidAmount: 0,
          status: PrismaBS.UNPAID,
          dueDate: new Date(dueDate),
          memo: '',
          scheduledCount,
          absentCount: null,
          makeupCount: null,
        },
      });
      created++;
    }

    return NextResponse.json({ created, refreshed });
  } catch (err) {
    console.error('[POST /api/finance/bills/generate]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
