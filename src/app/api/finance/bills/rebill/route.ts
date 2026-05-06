import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS } from '@/generated/prisma/client';
import { calcPerLessonAmount } from '@/lib/utils/billing';

/**
 * POST /api/finance/bills/rebill
 * 원장 전용 — 취소된 청구서를 실출결 기반으로 재청구
 *
 * Body:
 *   preview?: boolean   — true면 계산액만 반환, DB 저장 없음
 *   items: [
 *     { billId: string, amount: number, dueDate: string }  // amount는 원장이 확정한 금액
 *   ]
 *   sendNotification?: boolean  — 재청구 알림 발송 여부
 */

function toKSTDate(d: Date): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(d);
}

export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const role      = req.headers.get('x-user-role');

  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { items, sendNotification = false, preview = false } = body as {
      items?: { billId: string; amount: number; dueDate: string }[];
      sendNotification?: boolean;
      preview?: boolean;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items는 필수입니다.' }, { status: 400 });
    }

    // 취소된 청구서 조회 + 계산액 산출
    const results: {
      billId: string;
      studentId: string;
      studentName: string;
      classId: string;
      className: string;
      month: string;
      calculatedAmount: number;
      scheduledCount?: number;
      absentCount?: number;
      makeupCount?: number;
      feeType: string;
    }[] = [];

    for (const item of items) {
      const cancelled = await prisma.bill.findUnique({
        where: { id: item.billId },
        select: {
          id: true, academyId: true, status: true,
          studentId: true, classId: true, month: true,
          student: { select: { name: true } },
          class: { select: { name: true, feeType: true, fee: true } },
        },
      });

      if (!cancelled) {
        return NextResponse.json({ error: `청구서 ${item.billId}를 찾을 수 없습니다.` }, { status: 404 });
      }
      if (cancelled.academyId !== academyId) {
        return NextResponse.json({ error: '권한 없음' }, { status: 403 });
      }
      if (cancelled.status !== PrismaBS.CANCELLED) {
        return NextResponse.json(
          { error: `청구서 ${item.billId}는 취소 상태가 아닙니다.` },
          { status: 400 },
        );
      }

      let calculatedAmount = cancelled.class.fee;
      let scheduledCount: number | undefined;
      let absentCount: number | undefined;
      let makeupCount: number | undefined;

      if (cancelled.class.feeType === 'per-lesson') {
        const calc = await calcPerLessonAmount(cancelled.classId, cancelled.studentId, cancelled.month);
        calculatedAmount = calc.amount;
        scheduledCount = calc.scheduledCount;
        absentCount = calc.absentCount;
        makeupCount = calc.makeupCount;
      }

      results.push({
        billId: cancelled.id,
        studentId: cancelled.studentId,
        studentName: cancelled.student.name,
        classId: cancelled.classId,
        className: cancelled.class.name,
        month: cancelled.month,
        calculatedAmount,
        scheduledCount,
        absentCount,
        makeupCount,
        feeType: cancelled.class.feeType,
      });
    }

    // preview 모드: 계산만 반환
    if (preview) {
      return NextResponse.json(results);
    }

    // ── 실제 재청구 ──────────────────────────────────────────────────────
    const createdBills: string[] = [];
    const studentNotifMap = new Map<string, { studentId: string; studentName: string; lines: string[] }>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const r = results[i];

      // 이미 동일 월에 UNPAID/PARTIAL/PAID 청구서가 있으면 건너뜀
      const alreadyActive = await prisma.bill.findFirst({
        where: {
          studentId: r.studentId,
          classId: r.classId,
          month: r.month,
          status: { not: PrismaBS.CANCELLED },
        },
      });
      if (alreadyActive) continue;

      const finalAmount = typeof item.amount === 'number' && item.amount > 0 ? item.amount : r.calculatedAmount;
      const dueDate = item.dueDate ? new Date(item.dueDate) : (() => {
        const [y, m] = r.month.split('-');
        return new Date(`${y}-${m}-25`);
      })();

      const newBill = await prisma.bill.create({
        data: {
          academyId,
          studentId: r.studentId,
          classId: r.classId,
          month: r.month,
          amount: finalAmount,
          paidAmount: 0,
          status: PrismaBS.UNPAID,
          dueDate,
          scheduledCount: r.scheduledCount ?? null,
          absentCount: r.absentCount ?? null,
          makeupCount: r.makeupCount ?? null,
          rebillOfId: r.billId,
        },
      });

      createdBills.push(newBill.id);

      // 알림 대상 수집
      if (sendNotification) {
        if (!studentNotifMap.has(r.studentId)) {
          studentNotifMap.set(r.studentId, {
            studentId: r.studentId,
            studentName: r.studentName,
            lines: [],
          });
        }
        const monthStr = `${r.month.slice(0, 4)}년 ${parseInt(r.month.slice(5, 7))}월`;
        studentNotifMap.get(r.studentId)!.lines.push(
          `• ${r.className} | ${monthStr} | ${finalAmount.toLocaleString()}원`,
        );
      }
    }

    // ── 재청구 알림 발송 ─────────────────────────────────────────────────
    if (sendNotification && studentNotifMap.size > 0) {
      for (const { studentId, studentName, lines } of studentNotifMap.values()) {
        const total = createdBills.length; // 상세 합계는 클라이언트가 알고 있음
        const content = [
          `안녕하세요, 학원입니다.`,
          ``,
          `${studentName} 학부모님께,`,
          `이전 결제가 취소되어 실출결 기준으로 수강료가 재청구되었습니다.`,
          ``,
          `📋 재청구 내역 (해당 월 결제 취소 후 재청구)`,
          ...lines,
          ``,
          `아래 [결제하기] 버튼을 눌러 납부를 진행해 주시기 바랍니다.`,
          ``,
          `감사합니다.`,
        ].join('\n');

        await prisma.notification.create({
          data: {
            academyId,
            type: 'PAYMENT_ALERT',
            title: `수강료 재청구 안내`,
            content,
            metadata: { billIds: createdBills, rebill: true },
            recipients: {
              create: { studentId },
            },
          },
        });
      }
    }

    return NextResponse.json({ created: createdBills.length, billIds: createdBills });
  } catch (err) {
    console.error('[POST /api/finance/bills/rebill]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
