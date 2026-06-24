import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS } from '@/generated/prisma/client';
import { calcInitialPerLessonAmount } from '@/lib/utils/billing';
import { requireAuth } from '@/lib/auth/requireAuth';

// POST /api/finance/bills/generate
// body: { month: "YYYY-MM", dueDate?: "YYYY-MM-DD" }
// 활성 수강생 전체 대상으로 해당 월 청구서 일괄 생성·갱신
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { month, dueDate: bodyDueDate } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month(YYYY-MM)은 필수입니다.' }, { status: 400 });
    }

    // 납부기한: body 우선, 없으면 학원 설정(billingDueDay, 기본 25일).
    // 설정 일자가 해당 월 말일을 넘으면 그 달 말일로 보정 (예: 31일 설정 + 2월 → 28/29일).
    let dueDate: string;
    if (bodyDueDate) {
      dueDate = bodyDueDate;
    } else {
      const academy = await prisma.academy.findUnique({
        where: { id: academyId },
        select: { billingDueDay: true },
      });
      const [y, mo] = month.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate(); // mo(1-based) → 해당 월 말일
      const day = Math.min(Math.max(academy?.billingDueDay ?? 25, 1), lastDay);
      dueDate = `${month}-${String(day).padStart(2, '0')}`;
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: { isActive: true, class: { academyId } },
      select: {
        studentId: true,
        classId: true,
        class: { select: { feeType: true, fee: true } },
      },
    });

    // N+1 방지: 해당 월 활성 청구서를 한 번에 조회 후 Set으로 중복 검사
    const existingBills = await prisma.bill.findMany({
      where: {
        academyId,
        month,
        status: { notIn: [PrismaBS.CANCELLED] }, // DRAFT 포함 모두 중복으로 간주
      },
      select: { studentId: true, classId: true },
    });
    const existingSet = new Set(existingBills.map((b) => `${b.studentId}:${b.classId}`));

    let created = 0;
    const refreshed = 0; // 더 이상 자동 재계산 없음 (재청구 흐름으로 분리)

    for (const enr of enrollments) {
      // 이미 활성(초안/미납/부분납/완납) 청구서가 있으면 생성 건너뜀
      if (existingSet.has(`${enr.studentId}:${enr.classId}`)) {
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
    await logServerError(req, err);
    console.error('[POST /api/finance/bills/generate]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
