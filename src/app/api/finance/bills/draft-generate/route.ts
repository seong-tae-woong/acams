import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS } from '@/generated/prisma/client';
import { calcInitialPerLessonAmount, calculateBillWithAdjustments } from '@/lib/utils/billing';
import { requireAuth } from '@/lib/auth/requireAuth';

/**
 * POST /api/finance/bills/draft-generate
 * 원장 전용 — 활성 수강생 전체 대상으로 DRAFT 청구서 일괄 생성
 *
 * 기존 generate와의 차이:
 *   - 청구서 status = DRAFT (원장 검토 후 확정 필요)
 *   - Layer 2+3 조정이 즉시 반영된 금액으로 생성
 *   - 이미 DRAFT/UNPAID/PARTIAL/PAID 청구서가 있는 수강생은 건너뜀
 *
 * Body: { month: "YYYY-MM", dueDate?: "YYYY-MM-DD" }
 *
 * Response:
 *   created: number          — 생성된 DRAFT 청구서 수
 *   skipped: number          — 이미 청구서가 있어 건너뜀
 *   billIds: string[]        — 생성된 청구서 id 목록
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

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
        id: true,
        studentId: true,
        classId: true,
        class: { select: { feeType: true, fee: true } },
      },
    });

    // N+1 방지: 해당 월 활성 청구서를 한 번에 조회
    const existingBills = await prisma.bill.findMany({
      where: {
        academyId,
        month,
        status: { notIn: [PrismaBS.CANCELLED] },
      },
      select: { studentId: true, classId: true },
    });
    const existingSet = new Set(existingBills.map((b) => `${b.studentId}:${b.classId}`));

    let created = 0;
    let skipped = 0;
    const billIds: string[] = [];

    for (const enr of enrollments) {
      if (existingSet.has(`${enr.studentId}:${enr.classId}`)) {
        skipped++;
        continue;
      }

      let amount: number;
      let scheduledCount: number | null = null;

      if (enr.class.feeType === 'per-lesson') {
        const calc = await calcInitialPerLessonAmount(enr.classId, month);
        amount = calc.amount;
        scheduledCount = calc.scheduledCount;
      } else {
        amount = enr.class.fee;
      }

      const bill = await prisma.bill.create({
        data: {
          academyId,
          studentId: enr.studentId,
          classId: enr.classId,
          month,
          amount,
          paidAmount: 0,
          status: PrismaBS.DRAFT,  // ← DRAFT로 생성
          dueDate: new Date(dueDate),
          memo: '',
          scheduledCount,
          absentCount: null,
          makeupCount: null,
        },
        select: { id: true },
      });

      billIds.push(bill.id);
      created++;
    }

    // Layer 2+3 조정 일괄 적용 (DRAFT 상태이므로 status는 변경되지 않음)
    if (billIds.length > 0) {
      await Promise.all(billIds.map((id) => calculateBillWithAdjustments(id)));
    }

    return NextResponse.json({ created, skipped, billIds });
  } catch (err) {
    console.error('[POST /api/finance/bills/draft-generate]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
