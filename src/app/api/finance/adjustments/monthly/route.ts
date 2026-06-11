import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { calculateBillWithAdjustments } from '@/lib/utils/billing';

/**
 * GET  /api/finance/adjustments/monthly?billingMonth=YYYY-MM
 * POST /api/finance/adjustments/monthly
 *
 * 원장 전용 — 월별 일회성 조정 (Layer 3) 관리
 *
 * POST body:
 *   billingMonth: string   — "YYYY-MM"
 *   scope: "class" | "student"
 *   classId?: string       — scope === "class"일 때 필수
 *   studentId?: string     — scope === "student"일 때 필수
 *   label: string          — 표시 이름 (예: "행사 할인")
 *   direction: "discount" | "add"
 *   amount: number         — 원 단위 양수
 *   memo?: string
 */

// 조정 생성·삭제 후 해당 월 활성 청구서 재계산
async function recalcBillsForAdjustment(
  academyId: string,
  billingMonth: string,
  scope: string,
  classId: string | null,
  studentId: string | null,
) {
  const bills = await prisma.bill.findMany({
    where: {
      academyId,
      month: billingMonth,
      status: { notIn: ['PAID', 'CANCELLED'] },
      ...(scope === 'class' && classId ? { classId } : {}),
      ...(scope === 'student' && studentId ? { studentId } : {}),
    },
    select: { id: true },
  });

  await Promise.all(bills.map((b) => calculateBillWithAdjustments(b.id)));
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  const billingMonth = new URL(req.url).searchParams.get('billingMonth');
  if (!billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) {
    return NextResponse.json({ error: 'billingMonth(YYYY-MM)는 필수입니다.' }, { status: 400 });
  }

  try {
    const adjustments = await prisma.monthlyAdjustment.findMany({
      where: { academyId, billingMonth },
      include: {
        class: { select: { name: true } },
        student: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(
      adjustments.map((a) => ({
        id: a.id,
        billingMonth: a.billingMonth,
        scope: a.scope,
        classId: a.classId,
        className: a.class?.name ?? null,
        studentId: a.studentId,
        studentName: a.student?.name ?? null,
        label: a.label,
        direction: a.direction,
        amount: a.amount,
        memo: a.memo,
        createdAt: a.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    console.error('[GET /api/finance/adjustments/monthly]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      billingMonth?: string;
      scope?: string;
      classId?: string;
      studentId?: string;
      label?: string;
      direction?: string;
      amount?: number;
      memo?: string;
    };

    const {
      billingMonth,
      scope,
      classId = null,
      studentId = null,
      label,
      direction,
      amount,
      memo = '',
    } = body;

    // 필수 검증
    if (!billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) {
      return NextResponse.json({ error: 'billingMonth(YYYY-MM)는 필수입니다.' }, { status: 400 });
    }
    if (!label || !direction || amount === undefined) {
      return NextResponse.json({ error: 'label, direction, amount는 필수입니다.' }, { status: 400 });
    }
    if (scope !== 'class' && scope !== 'student') {
      return NextResponse.json({ error: 'scope는 "class" 또는 "student"여야 합니다.' }, { status: 400 });
    }
    if (direction !== 'discount' && direction !== 'add') {
      return NextResponse.json({ error: 'direction은 "discount" 또는 "add"여야 합니다.' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount는 양수여야 합니다.' }, { status: 400 });
    }
    if (scope === 'class' && !classId) {
      return NextResponse.json({ error: 'scope가 "class"면 classId는 필수입니다.' }, { status: 400 });
    }
    if (scope === 'student' && !studentId) {
      return NextResponse.json({ error: 'scope가 "student"면 studentId는 필수입니다.' }, { status: 400 });
    }

    // 학원 소속 확인
    if (classId) {
      const cls = await prisma.class.findUnique({ where: { id: classId }, select: { academyId: true } });
      if (!cls || cls.academyId !== academyId) {
        return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });
      }
    }
    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { academyId: true } });
      if (!student || student.academyId !== academyId) {
        return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
      }
    }

    const adjustment = await prisma.monthlyAdjustment.create({
      data: {
        academyId,
        billingMonth,
        scope,
        classId: scope === 'class' ? classId : null,
        studentId: scope === 'student' ? studentId : null,
        label,
        direction,
        amount,
        memo,
      },
      include: {
        class: { select: { name: true } },
        student: { select: { name: true } },
      },
    });

    // 활성 청구서에 즉시 반영
    await recalcBillsForAdjustment(academyId, billingMonth, scope, classId ?? null, studentId ?? null);

    return NextResponse.json(
      {
        id: adjustment.id,
        billingMonth: adjustment.billingMonth,
        scope: adjustment.scope,
        classId: adjustment.classId,
        className: adjustment.class?.name ?? null,
        studentId: adjustment.studentId,
        studentName: adjustment.student?.name ?? null,
        label: adjustment.label,
        direction: adjustment.direction,
        amount: adjustment.amount,
        memo: adjustment.memo,
        createdAt: adjustment.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[POST /api/finance/adjustments/monthly]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
