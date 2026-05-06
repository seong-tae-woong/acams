import { prisma } from '@/lib/db/prisma';
import { BillStatus, AttendanceStatus } from '@/generated/prisma/client';

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

  let status: BillStatus;
  if (amount === 0) {
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
