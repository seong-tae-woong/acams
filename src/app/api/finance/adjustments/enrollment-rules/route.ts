import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { calculateBillWithAdjustments } from '@/lib/utils/billing';

/**
 * GET  /api/finance/adjustments/enrollment-rules?enrollmentId=
 * POST /api/finance/adjustments/enrollment-rules
 *
 * 원장 전용 — 수강 등록별 할인/추가 규칙 (Layer 2) 관리
 *
 * POST body:
 *   enrollmentId: string
 *   label: string          — 표시 이름 (예: "형제 할인")
 *   direction: "discount" | "add"
 *   amountType?: "fixed" | "percent"   — 기본 "fixed"
 *   amount: number         — percent면 0-100, fixed면 원 단위 양수
 *   memo?: string
 */

// 규칙 생성·삭제 후 해당 수강의 활성 청구서 전체에 조정 재계산
async function recalcActiveBills(enrollmentId: string) {
  const enr = await prisma.classEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { studentId: true, classId: true },
  });
  if (!enr) return;

  const bills = await prisma.bill.findMany({
    where: {
      studentId: enr.studentId,
      classId: enr.classId,
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
    select: { id: true },
  });

  await Promise.all(bills.map((b) => calculateBillWithAdjustments(b.id)));
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  // teacher도 열람 가능 (추가·삭제는 director만)
  if (role !== 'director' && role !== 'super_admin' && role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  let enrollmentId = sp.get('enrollmentId');
  const studentId = sp.get('studentId');
  const classId   = sp.get('classId');

  try {
    // enrollmentId 없이 studentId+classId로 조회하는 경우 enrollment 자동 탐색
    if (!enrollmentId) {
      if (!studentId || !classId) {
        return NextResponse.json(
          { error: 'enrollmentId 또는 (studentId + classId) 중 하나는 필수입니다.' },
          { status: 400 },
        );
      }
      const found = await prisma.classEnrollment.findFirst({
        where: { studentId, classId, isActive: true },
        select: { id: true, class: { select: { academyId: true } } },
      });
      if (!found || found.class.academyId !== academyId) {
        // 수강 등록이 없으면 빈 배열 반환 (카드 렌더링은 항상 가능해야 함)
        return NextResponse.json({ enrollmentId: null, rules: [] });
      }
      enrollmentId = found.id;
    } else {
      // enrollmentId 직접 지정 시 소속 확인
      const enr = await prisma.classEnrollment.findUnique({
        where: { id: enrollmentId },
        select: { class: { select: { academyId: true } } },
      });
      if (!enr || enr.class.academyId !== academyId) {
        return NextResponse.json({ error: '수강 등록을 찾을 수 없습니다.' }, { status: 404 });
      }
    }

    const rules = await prisma.enrollmentRule.findMany({
      where: { enrollmentId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ enrollmentId, rules });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/finance/adjustments/enrollment-rules]', err instanceof Error ? err.message : String(err));
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
      enrollmentId?: string;
      label?: string;
      direction?: string;
      amountType?: string;
      amount?: number;
      memo?: string;
    };

    const { enrollmentId, label, direction, amountType = 'fixed', amount, memo = '' } = body;

    if (!enrollmentId || !label || !direction || amount === undefined) {
      return NextResponse.json(
        { error: 'enrollmentId, label, direction, amount는 필수입니다.' },
        { status: 400 },
      );
    }
    if (direction !== 'discount' && direction !== 'add') {
      return NextResponse.json({ error: 'direction은 "discount" 또는 "add"여야 합니다.' }, { status: 400 });
    }
    if (amountType !== 'fixed' && amountType !== 'percent') {
      return NextResponse.json({ error: 'amountType은 "fixed" 또는 "percent"여야 합니다.' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount는 양수여야 합니다.' }, { status: 400 });
    }
    if (amountType === 'percent' && amount > 100) {
      return NextResponse.json({ error: '퍼센트 할인은 100%를 초과할 수 없습니다.' }, { status: 400 });
    }

    // 수강 등록 소속 확인 (class 관계를 통해 academyId 검증)
    const enr = await prisma.classEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { class: { select: { academyId: true } } },
    });
    if (!enr || enr.class.academyId !== academyId) {
      return NextResponse.json({ error: '수강 등록을 찾을 수 없습니다.' }, { status: 404 });
    }

    const rule = await prisma.enrollmentRule.create({
      data: { academyId, enrollmentId, label, direction, amountType, amount, memo },
    });

    // 활성 청구서에 즉시 반영
    await recalcActiveBills(enrollmentId);

    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/finance/adjustments/enrollment-rules]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
