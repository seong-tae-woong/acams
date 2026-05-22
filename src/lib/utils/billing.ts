import { prisma } from '@/lib/db/prisma';
import { BillStatus, AttendanceStatus, Prisma } from '@/generated/prisma/client';

// DayOfWeek DB 저장값(1=월..6=토, 7=일) → JS getDay()(0=일..6=토)
function toJsDay(dbDow: number): number {
  return dbDow === 7 ? 0 : dbDow;
}

function getMonthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

// 해당 월에 classSchedule 기준으로 수업이 열리는 날 수 계산
function countScheduledLessons(
  schedules: { dayOfWeek: number }[],
  start: Date,
  end: Date,
): number {
  const scheduledDays = new Set(schedules.map((s) => toJsDay(s.dayOfWeek)));
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    if (scheduledDays.has(d.getDay())) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Bill 하나를 per-lesson 기준으로 재계산하고 DB 업데이트
// tx 없이 호출 가능 (독립 실행) — 출결/보강 변경 후 호출
export async function recalculateBill(billId: string): Promise<void> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    select: {
      classId: true,
      studentId: true,
      month: true,
      paidAmount: true,
      status: true,
      class: {
        select: {
          feeType: true,
          fee: true,
          schedules: { select: { dayOfWeek: true } },
        },
      },
    },
  });

  if (!bill || bill.class.feeType !== 'per-lesson') return;
  if (bill.status === BillStatus.PAID) return;

  const { start, end } = getMonthRange(bill.month);

  const scheduledCount = countScheduledLessons(bill.class.schedules, start, end);

  const absentCount = await prisma.attendanceRecord.count({
    where: {
      classId: bill.classId,
      studentId: bill.studentId,
      status: AttendanceStatus.ABSENT,
      date: { gte: start, lt: end },
    },
  });

  // originalDate 기준 — 결석한 날의 보강을 들은 경우만 차감 복원
  const makeupCount = await prisma.makeupClass.count({
    where: {
      originalClassId: bill.classId,
      attendanceChecked: true,
      originalDate: { gte: start, lt: end },
      targets: { some: { studentId: bill.studentId } },
    },
  });

  const chargeableLessons = Math.max(0, scheduledCount - absentCount + makeupCount);
  const amount = chargeableLessons * bill.class.fee;

  // DRAFT는 상태 변경 없이 금액만 갱신 (확정 시 별도로 UNPAID로 전환)
  let status: BillStatus;
  if (bill.status === BillStatus.DRAFT) {
    status = BillStatus.DRAFT;
  } else if (amount === 0) {
    status = bill.paidAmount > 0 ? BillStatus.PAID : BillStatus.UNPAID;
  } else if (bill.paidAmount >= amount) {
    status = BillStatus.PAID;
  } else if (bill.paidAmount > 0) {
    status = BillStatus.PARTIAL;
  } else {
    status = BillStatus.UNPAID;
  }

  await prisma.bill.update({
    where: { id: billId },
    data: { amount, scheduledCount, absentCount, makeupCount, status },
  });

  // Layer 2+3 조정 적용 (per-lesson 기반액 위에 덮어씀)
  await calculateBillWithAdjustments(billId);
}

// 특정 학생+반+월의 per-lesson 청구서를 찾아 재계산
// @@unique 제약 제거 후 findFirst 사용 (UNPAID/PARTIAL 상태만 대상)
export async function recalculateBillByContext(
  studentId: string,
  classId: string,
  month: string,
): Promise<void> {
  const bill = await prisma.bill.findFirst({
    where: {
      studentId,
      classId,
      month,
      status: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] },
    },
    select: { id: true },
  });
  if (!bill) return;
  await recalculateBill(bill.id);
}

// per-lesson 청구서의 초기 amount를 계산 — 스케줄 기반만, 출결 데이터 없이 (월초 청구 생성 시)
export async function calcInitialPerLessonAmount(
  classId: string,
  month: string,
): Promise<{ amount: number; scheduledCount: number }> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { fee: true, schedules: { select: { dayOfWeek: true } } },
  });
  if (!cls) return { amount: 0, scheduledCount: 0 };

  const { start, end } = getMonthRange(month);
  const scheduledCount = countScheduledLessons(cls.schedules, start, end);
  return { amount: scheduledCount * cls.fee, scheduledCount };
}

/**
 * calculateBillWithAdjustments
 * Layer 2 (EnrollmentRule) + Layer 3 (MonthlyAdjustment) 조정을 적용해 청구액을 재계산.
 *
 * 호출 시점:
 *   - recalculateBill() 체인 끝 (per-lesson 기반액 갱신 후)
 *   - 조정 규칙 CRUD 후 즉시
 *   - DRAFT 확정 API (tx 포함, 이후 호출부에서 status UNPAID로 전환)
 *
 * 적용 순서 (OoO):
 *   1. base_tuition (Bill.amount 현재값)
 *   2. percent EnrollmentRule (할인 → 추가 순, createdAt asc)
 *   3. fixed  EnrollmentRule
 *   4. MonthlyAdjustment (class/student scope 공통)
 *   5. Math.round() → max(0, …)
 *
 * DRAFT 상태 청구서: 금액만 갱신, 상태 변경 없음.
 * PAID 청구서: 스킵.
 */
export async function calculateBillWithAdjustments(
  billId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;

  const bill = await db.bill.findUnique({
    where: { id: billId },
    select: {
      academyId: true,
      classId: true,
      studentId: true,
      month: true,
      amount: true,
      paidAmount: true,
      status: true,
    },
  });

  if (!bill) return;
  if (bill.status === BillStatus.PAID) return;

  // Layer 2 — 수강 등록 규칙
  const enrollment = await db.classEnrollment.findFirst({
    where: { classId: bill.classId, studentId: bill.studentId, isActive: true },
    select: { id: true },
  });

  const enrollmentRules = enrollment
    ? await db.enrollmentRule.findMany({
        where: { enrollmentId: enrollment.id },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  // Layer 3 — 월별 조정 (반 scope 또는 학생 scope)
  const monthlyAdjustments = await db.monthlyAdjustment.findMany({
    where: {
      academyId: bill.academyId,
      billingMonth: bill.month,
      OR: [
        { scope: 'class', classId: bill.classId },
        { scope: 'student', studentId: bill.studentId },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  // OoO 적용
  let adjusted: number = bill.amount;

  // 1) percent 규칙 (할인 먼저, 추가 나중 — 생성 순서 유지)
  for (const rule of enrollmentRules) {
    if (rule.amountType !== 'percent') continue;
    const factor =
      rule.direction === 'discount'
        ? 1 - rule.amount / 100
        : 1 + rule.amount / 100;
    adjusted *= factor;
  }

  // 2) fixed 규칙
  for (const rule of enrollmentRules) {
    if (rule.amountType !== 'fixed') continue;
    adjusted =
      rule.direction === 'discount'
        ? adjusted - rule.amount
        : adjusted + rule.amount;
  }

  // 3) 월별 조정
  for (const adj of monthlyAdjustments) {
    adjusted =
      adj.direction === 'discount'
        ? adjusted - adj.amount
        : adjusted + adj.amount;
  }

  const finalAmount = Math.max(0, Math.round(adjusted));

  // 납부 상태 재계산 (DRAFT는 상태 보존)
  let newStatus: BillStatus = bill.status;
  if (bill.status !== BillStatus.DRAFT) {
    if (finalAmount === 0) {
      newStatus = bill.paidAmount > 0 ? BillStatus.PAID : BillStatus.UNPAID;
    } else if (bill.paidAmount >= finalAmount) {
      newStatus = BillStatus.PAID;
    } else if (bill.paidAmount > 0) {
      newStatus = BillStatus.PARTIAL;
    } else {
      newStatus = BillStatus.UNPAID;
    }
  }

  await db.bill.update({
    where: { id: billId },
    data: { amount: finalAmount, status: newStatus },
  });
}

// per-lesson 청구서의 출결 기반 amount를 계산 (재청구 시 사용)
export async function calcPerLessonAmount(
  classId: string,
  studentId: string,
  month: string,
): Promise<{ amount: number; scheduledCount: number; absentCount: number; makeupCount: number }> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { fee: true, schedules: { select: { dayOfWeek: true } } },
  });
  if (!cls) return { amount: 0, scheduledCount: 0, absentCount: 0, makeupCount: 0 };

  const { start, end } = getMonthRange(month);
  const scheduledCount = countScheduledLessons(cls.schedules, start, end);

  const absentCount = await prisma.attendanceRecord.count({
    where: {
      classId,
      studentId,
      status: AttendanceStatus.ABSENT,
      date: { gte: start, lt: end },
    },
  });

  const makeupCount = await prisma.makeupClass.count({
    where: {
      originalClassId: classId,
      attendanceChecked: true,
      originalDate: { gte: start, lt: end },
      targets: { some: { studentId } },
    },
  });

  const chargeableLessons = Math.max(0, scheduledCount - absentCount + makeupCount);
  return {
    amount: chargeableLessons * cls.fee,
    scheduledCount,
    absentCount,
    makeupCount,
  };
}
