import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS } from '@/generated/prisma/client';
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
          status: { notIn: [PrismaBS.CANCELLED, PrismaBS.DRAFT] }, // 취소·초안 미노출
        },
        include: { class: { select: { name: true, fee: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.receipt.findMany({
        where: { studentId, cancelledAt: null }, // 취소된 영수증 미노출
        orderBy: { issuedDate: 'desc' },
      }),
    ]);

    // 청구서별 조정 내역 일괄 조회 (N+1 방지)
    // 1) 수강 등록 ID 맵
    const classIds = [...new Set(bills.map((b) => b.classId))];
    const enrollments = await prisma.classEnrollment.findMany({
      where: { studentId, classId: { in: classIds }, isActive: true },
      select: { id: true, classId: true },
    });
    const enrollmentMap = new Map(enrollments.map((e) => [e.classId, e.id]));
    const enrollmentIds = enrollments.map((e) => e.id);

    // 2) EnrollmentRule 일괄 조회
    const enrollmentRules = enrollmentIds.length > 0
      ? await prisma.enrollmentRule.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const rulesByEnrollment = new Map<string, typeof enrollmentRules>();
    for (const r of enrollmentRules) {
      if (!rulesByEnrollment.has(r.enrollmentId)) rulesByEnrollment.set(r.enrollmentId, []);
      rulesByEnrollment.get(r.enrollmentId)!.push(r);
    }

    // 3) MonthlyAdjustment 일괄 조회 (해당 월 + 학생 scope)
    const months = [...new Set(bills.map((b) => b.month))];
    const monthlyAdjs = months.length > 0
      ? await prisma.monthlyAdjustment.findMany({
          where: {
            academyId,
            billingMonth: { in: months },
            OR: [
              { scope: 'class', classId: { in: classIds } },
              { scope: 'student', studentId },
            ],
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    return NextResponse.json({
      bills: bills.map((b) => {
        const enrollmentId = enrollmentMap.get(b.classId);
        const rules = enrollmentId ? (rulesByEnrollment.get(enrollmentId) ?? []) : [];
        const adjItems = monthlyAdjs.filter(
          (a) => a.billingMonth === b.month &&
            ((a.scope === 'class' && a.classId === b.classId) || (a.scope === 'student' && a.studentId === studentId)),
        );

        const adjustments = [
          ...rules.map((r) => ({
            label: r.label,
            direction: r.direction,
            amount: r.amount,
            amountType: r.amountType,
          })),
          ...adjItems.map((a) => ({
            label: a.label,
            direction: a.direction,
            amount: a.amount,
            amountType: 'fixed' as const,
          })),
        ];

        return {
          id: b.id,
          className: b.class.name,
          month: b.month,
          amount: b.amount,
          baseFee: b.class.fee,
          paidAmount: b.paidAmount,
          status: b.status,
          dueDate: b.dueDate.toISOString().slice(0, 10),
          memo: b.memo,
          adjustments,
        };
      }),
      receipts: receipts.map((r) => ({
        id: r.id,
        amount: r.amount,
        issuedDate: r.issuedDate.toISOString().slice(0, 10),
        method: r.method,
      })),
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/mobile/payments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
