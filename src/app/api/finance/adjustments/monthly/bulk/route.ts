import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { calculateBillWithAdjustments } from '@/lib/utils/billing';

/**
 * POST /api/finance/adjustments/monthly/bulk
 * 원장 전용 — 반의 특정 학생들에게 월별 조정을 일괄 생성.
 *
 * Body:
 *   billingMonth: string   — "YYYY-MM"
 *   classId: string        — 컨텍스트 (검증용)
 *   studentIds: string[]   — 적용 대상 학생 (해당 반에 활성 등록된 학생만 허용)
 *   label: string          — 표시 이름 (드롭다운 선택 또는 사용자 입력)
 *   direction: "discount" | "add"
 *   amount: number         — 양수, 원 단위
 *   memo?: string
 *   saveLabel?: boolean    — true면 label을 AdjustmentLabel 사전에 추가 (이미 있으면 무시)
 *
 * 각 학생당 scope="student"인 MonthlyAdjustment 1건씩 생성.
 * 동일 (학생·월·label·direction·amount) 조합이 이미 있으면 건너뜀.
 *
 * Response: { created: number, skipped: number }
 */

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
      classId?: string;
      studentIds?: string[];
      label?: string;
      direction?: string;
      amount?: number;
      memo?: string;
      saveLabel?: boolean;
    };

    const {
      billingMonth, classId, studentIds, label, direction, amount,
      memo = '', saveLabel = false,
    } = body;

    if (!billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) {
      return NextResponse.json({ error: 'billingMonth(YYYY-MM)는 필수입니다.' }, { status: 400 });
    }
    if (!classId) {
      return NextResponse.json({ error: 'classId는 필수입니다.' }, { status: 400 });
    }
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: 'studentIds는 1명 이상 필요합니다.' }, { status: 400 });
    }
    if (!label?.trim()) {
      return NextResponse.json({ error: 'label은 필수입니다.' }, { status: 400 });
    }
    if (direction !== 'discount' && direction !== 'add') {
      return NextResponse.json({ error: 'direction은 "discount" 또는 "add"여야 합니다.' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount는 양수여야 합니다.' }, { status: 400 });
    }

    // 반 소속 검증
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { academyId: true },
    });
    if (!cls || cls.academyId !== academyId) {
      return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 모든 studentId가 해당 반에 활성 등록되어 있는지 확인
    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId, studentId: { in: studentIds }, isActive: true },
      select: { studentId: true },
    });
    const validStudentIds = new Set(enrollments.map((e) => e.studentId));
    if (validStudentIds.size !== studentIds.length) {
      return NextResponse.json({ error: '반에 속하지 않은 학생이 포함되어 있습니다.' }, { status: 400 });
    }

    const trimmedLabel = label.trim();

    // 명칭 사전 저장 (옵션) — 이미 있으면 무시
    if (saveLabel) {
      await prisma.adjustmentLabel.upsert({
        where: { academyId_name: { academyId, name: trimmedLabel } },
        create: { academyId, name: trimmedLabel },
        update: {},
      });
    }

    // 중복 방지: 학생별 동일 (월·label·direction·amount) 조합 존재 시 skip
    const existing = await prisma.monthlyAdjustment.findMany({
      where: {
        academyId,
        billingMonth,
        scope: 'student',
        studentId: { in: studentIds },
        label: trimmedLabel,
        direction,
        amount,
      },
      select: { studentId: true },
    });
    const existingStudentIds = new Set(existing.map((a) => a.studentId).filter(Boolean) as string[]);

    let created = 0;
    let skipped = 0;
    const affectedStudentIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const sid of studentIds) {
        if (existingStudentIds.has(sid)) {
          skipped++;
          continue;
        }
        await tx.monthlyAdjustment.create({
          data: {
            academyId,
            billingMonth,
            scope: 'student',
            classId: null,         // 학생 scope이므로 classId는 null
            studentId: sid,
            label: trimmedLabel,
            direction,
            amount,
            memo,
          },
        });
        affectedStudentIds.push(sid);
        created++;
      }
    });

    // 활성 청구서에 즉시 반영
    if (affectedStudentIds.length > 0) {
      const bills = await prisma.bill.findMany({
        where: {
          academyId,
          month: billingMonth,
          studentId: { in: affectedStudentIds },
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        select: { id: true },
      });
      await Promise.all(bills.map((b) => calculateBillWithAdjustments(b.id)));
    }

    return NextResponse.json({ created, skipped });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/finance/adjustments/monthly/bulk]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
