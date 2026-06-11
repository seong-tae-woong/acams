import { prisma } from '@/lib/db/prisma';
import { BillStatus, AttendanceStatus, StudentStatus, Prisma } from '@/generated/prisma/client';

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
 * 멱등성 보장:
 *   base는 매번 class.fee + (per-lesson) scheduled/absent/makeup 컬럼으로 다시 계산.
 *   bill.amount 자체를 base로 사용하면 두 번 호출 시 percent 할인이 누적됨.
 *
 * 호출 시점:
 *   - recalculateBill() 체인 끝 (per-lesson 출결 변경 시)
 *   - 조정 규칙 CRUD 후 즉시
 *   - DRAFT 확정 API (tx 포함, 이후 호출부에서 status UNPAID로 전환)
 *
 * 적용 순서 (OoO):
 *   1. base_tuition (per-lesson: chargeable × fee, 그 외: class.fee)
 *   2. percent EnrollmentRule (createdAt asc)
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
      paidAmount: true,
      status: true,
      scheduledCount: true,
      absentCount: true,
      makeupCount: true,
      class: { select: { fee: true, feeType: true } },
    },
  });

  if (!bill) return;
  if (bill.status === BillStatus.PAID) return;

  // ── base 산출 (멱등성) ────────────────────────────────────
  // per-lesson은 청구서에 저장된 출결 카운트로 base를 다시 계산.
  // 그 외는 class.fee가 base.
  let base: number;
  if (bill.class.feeType === 'per-lesson') {
    const chargeable = Math.max(
      0,
      (bill.scheduledCount ?? 0) - (bill.absentCount ?? 0) + (bill.makeupCount ?? 0),
    );
    base = chargeable * bill.class.fee;
  } else {
    base = bill.class.fee;
  }

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
  let adjusted: number = base;

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

/**
 * syncSiblingDiscountsForStudent
 * 학생의 현재 수강 등록(active)에 대해 형제 할인 자동 EnrollmentRule을 동기화.
 *
 * 적용 조건:
 *   - 학생에게 ≥1명의 형제가 학원에 활성 학생(status="active")으로 존재
 *   - 학원 설정 siblingDiscountDefault > 0
 *
 * 동작:
 *   - 조건 충족 → 해당 학생의 모든 활성 enrollment에 isAuto=true,autoTag="sibling" 규칙 보장
 *   - 조건 미충족 → 기존 자동 규칙 제거
 *   - 금액/타입은 항상 현재 학원 설정값으로 덮어씀 (수동 수정 의도가 없음)
 *
 * 호출 시점: 수강 등록 변경, 형제 관계 변경, 학원 설정 변경.
 */
export async function syncSiblingDiscountsForStudent(
  studentId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, academyId: true, status: true },
  });
  if (!student || student.status !== StudentStatus.ACTIVE) return;

  // 학원 설정
  const academy = await db.academy.findUnique({
    where: { id: student.academyId },
    select: { siblingDiscountDefault: true, siblingDiscountType: true },
  });
  if (!academy) return;

  // 형제 양방향 조회 + 활성 상태 + 같은 학원 확인
  const links = await db.studentSibling.findMany({
    where: { OR: [{ studentAId: studentId }, { studentBId: studentId }] },
    select: { studentAId: true, studentBId: true },
  });
  const siblingIds = links.map((l) => (l.studentAId === studentId ? l.studentBId : l.studentAId));

  let qualifies = false;
  if (siblingIds.length > 0 && academy.siblingDiscountDefault > 0) {
    const activeSiblings = await db.student.count({
      where: { id: { in: siblingIds }, academyId: student.academyId, status: StudentStatus.ACTIVE },
    });
    qualifies = activeSiblings > 0;
  }

  // 학생의 활성 수강 등록 전체
  const enrollments = await db.classEnrollment.findMany({
    where: { studentId, isActive: true },
    select: { id: true, classId: true },
  });

  // 영향 받는 enrollment ID 모음 (재계산용)
  const affectedEnrollmentIds: string[] = [];

  for (const enr of enrollments) {
    const existing = await db.enrollmentRule.findFirst({
      where: { enrollmentId: enr.id, autoTag: 'sibling' },
      select: { id: true, amount: true, amountType: true },
    });

    if (qualifies) {
      // 보장: 없으면 생성, 있으면 금액/타입을 최신 설정으로 동기화
      if (!existing) {
        await db.enrollmentRule.create({
          data: {
            academyId: student.academyId,
            enrollmentId: enr.id,
            label: '형제 할인',
            direction: 'discount',
            amountType: academy.siblingDiscountType,
            amount: academy.siblingDiscountDefault,
            memo: '자동 적용',
            isAuto: true,
            autoTag: 'sibling',
          },
        });
        affectedEnrollmentIds.push(enr.id);
      } else if (
        existing.amount !== academy.siblingDiscountDefault ||
        existing.amountType !== academy.siblingDiscountType
      ) {
        await db.enrollmentRule.update({
          where: { id: existing.id },
          data: {
            amount: academy.siblingDiscountDefault,
            amountType: academy.siblingDiscountType,
          },
        });
        affectedEnrollmentIds.push(enr.id);
      }
    } else {
      // 조건 미충족 — 기존 자동 규칙 제거
      if (existing) {
        await db.enrollmentRule.delete({ where: { id: existing.id } });
        affectedEnrollmentIds.push(enr.id);
      }
    }
  }

  // 영향받은 enrollment의 활성 청구서 재계산
  if (affectedEnrollmentIds.length > 0) {
    const enrs = await db.classEnrollment.findMany({
      where: { id: { in: affectedEnrollmentIds } },
      select: { classId: true, studentId: true },
    });
    const bills = await db.bill.findMany({
      where: {
        OR: enrs.map((e) => ({ classId: e.classId, studentId: e.studentId })),
        status: { notIn: [BillStatus.PAID, BillStatus.CANCELLED] },
      },
      select: { id: true },
    });
    await Promise.all(bills.map((b) => calculateBillWithAdjustments(b.id, tx)));
  }
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

// 학원 전체 형제 할인 재동기화 — '형제 할인 저장 및 전체 적용'에서 사용.
// 전체 활성 학생을 순차로 도는 대신, ① 실제로 영향 받을 수 있는 학생(형제 링크 보유
// 또는 기존 'sibling' 자동 규칙 보유)만 추리고 — 나머지는 no-op이라 건너뜀 —
// ② 제한된 동시성으로 처리해 원격 DB 왕복 횟수와 대기 시간을 크게 줄인다.
export async function resyncAllSiblingDiscounts(academyId: string): Promise<void> {
  const activeStudents = await prisma.student.findMany({
    where: { academyId, status: StudentStatus.ACTIVE },
    select: { id: true },
  });
  if (activeStudents.length === 0) return;
  const activeIds = activeStudents.map((s) => s.id);
  const activeSet = new Set(activeIds);

  // 영향 받을 수 있는 학생만 추출 (형제 링크 OR 기존 형제 자동 규칙)
  const [links, rules] = await Promise.all([
    prisma.studentSibling.findMany({
      where: { OR: [{ studentAId: { in: activeIds } }, { studentBId: { in: activeIds } }] },
      select: { studentAId: true, studentBId: true },
    }),
    prisma.enrollmentRule.findMany({
      where: { academyId, autoTag: 'sibling' },
      select: { enrollment: { select: { studentId: true } } },
    }),
  ]);

  const affected = new Set<string>();
  for (const l of links) {
    if (activeSet.has(l.studentAId)) affected.add(l.studentAId);
    if (activeSet.has(l.studentBId)) affected.add(l.studentBId);
  }
  for (const r of rules) {
    if (activeSet.has(r.enrollment.studentId)) affected.add(r.enrollment.studentId);
  }

  // 제한된 동시성으로 처리 (DB 커넥션 풀 보호)
  const ids = [...affected];
  const CONCURRENCY = 5;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    await Promise.all(ids.slice(i, i + CONCURRENCY).map((id) => syncSiblingDiscountsForStudent(id)));
  }
}
