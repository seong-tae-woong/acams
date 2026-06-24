import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

/**
 * GET /api/finance/bills/[id]/details
 * 청구서의 세부 내역 — 수강료(base) + EnrollmentRule(Layer 2) + MonthlyAdjustment(Layer 3) + 레거시 조정
 *
 * 응답 구조:
 *   baseFee: number              — 기본 수강료
 *   baseAmount: number           — base × per-lesson 출결 반영액 (per-lesson은 chargeable × fee, 그 외 = baseFee)
 *   feeType: string              — "monthly" | "per-lesson" | "weekly"
 *   perLessonInfo?: {            — per-lesson 청구서일 때만
 *     scheduledCount, absentCount, makeupCount, chargeable
 *   }
 *   enrollmentRules: [{
 *     id, label, direction, amountType, amount, memo, isAuto, autoTag
 *   }]
 *   monthlyAdjustments: [{
 *     id, scope, label, direction, amount, memo
 *   }]
 *   legacyAdjust?: { amount, memo, count } | null
 *   finalAmount: number          — Bill.amount (저장된 최종액)
 *   paidAmount: number
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'super_admin' && role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const bill = await prisma.bill.findUnique({
      where: { id },
      select: {
        id: true, academyId: true,
        studentId: true, classId: true, month: true,
        amount: true, paidAmount: true,
        adjustAmount: true, adjustMemo: true,
        scheduledCount: true, absentCount: true, makeupCount: true,
        class: { select: { fee: true, feeType: true } },
        _count: { select: { adjustments: true } },
      },
    });

    if (!bill || bill.academyId !== academyId) {
      return NextResponse.json({ error: '청구서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // base 계산
    const baseFee = bill.class.fee;
    let baseAmount: number;
    let perLessonInfo: { scheduledCount: number; absentCount: number; makeupCount: number; chargeable: number } | undefined;

    if (bill.class.feeType === 'per-lesson') {
      const sched = bill.scheduledCount ?? 0;
      const absent = bill.absentCount ?? 0;
      const makeup = bill.makeupCount ?? 0;
      const chargeable = Math.max(0, sched - absent + makeup);
      baseAmount = chargeable * baseFee;
      perLessonInfo = { scheduledCount: sched, absentCount: absent, makeupCount: makeup, chargeable };
    } else {
      baseAmount = baseFee;
    }

    // Layer 2 — 수강 등록 규칙
    const enrollment = await prisma.classEnrollment.findFirst({
      where: { classId: bill.classId, studentId: bill.studentId, isActive: true },
      select: { id: true },
    });

    const enrollmentRules = enrollment
      ? await prisma.enrollmentRule.findMany({
          where: { enrollmentId: enrollment.id },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Layer 3 — 월별 조정
    const monthlyAdjustments = await prisma.monthlyAdjustment.findMany({
      where: {
        academyId,
        billingMonth: bill.month,
        OR: [
          { scope: 'class', classId: bill.classId },
          { scope: 'student', studentId: bill.studentId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      billId: bill.id,
      feeType: bill.class.feeType,
      baseFee,
      baseAmount,
      perLessonInfo,
      enrollmentRules: enrollmentRules.map((r) => ({
        id: r.id,
        label: r.label,
        direction: r.direction,
        amountType: r.amountType,
        amount: r.amount,
        memo: r.memo,
        isAuto: r.isAuto,
        autoTag: r.autoTag,
      })),
      monthlyAdjustments: monthlyAdjustments.map((a) => ({
        id: a.id,
        scope: a.scope,
        label: a.label,
        direction: a.direction,
        amount: a.amount,
        memo: a.memo,
      })),
      legacyAdjust: (bill.adjustAmount ?? 0) > 0
        ? { amount: bill.adjustAmount, memo: bill.adjustMemo, count: bill._count.adjustments }
        : null,
      finalAmount: bill.amount,
      paidAmount: bill.paidAmount,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/finance/bills/[id]/details]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
