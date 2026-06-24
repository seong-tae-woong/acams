import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { calculateBillWithAdjustments } from '@/lib/utils/billing';

/**
 * POST /api/finance/adjustments/monthly/copy-last-month
 * 원장 전용 — 지난달 MonthlyAdjustment를 이번 달로 복사
 *
 * Body:
 *   targetMonth?: string   — "YYYY-MM", 기본값: 현재 월 (KST 기준)
 *
 * 멱등 보장:
 *   5개 필드 (scope · classId · studentId · label · direction · amount) 조합이 동일한
 *   항목이 targetMonth에 이미 존재하면 건너뜀.
 *   (memo는 비교 대상 제외 — 이번 달에 메모를 수정했어도 재복사 시 덮어쓰지 않음)
 *
 * Response:
 *   { created: N, skipped: M }
 */

function currentKSTMonth(): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(new Date()).slice(0, 7);
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // m-1은 0-based, 한 달 전이므로 -2
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({})) as { targetMonth?: string };
    const targetMonth = body.targetMonth ?? currentKSTMonth();

    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return NextResponse.json({ error: 'targetMonth는 YYYY-MM 형식이어야 합니다.' }, { status: 400 });
    }

    const sourceMonth = prevMonth(targetMonth);

    // 지난달 조정 항목 전체 조회
    const sourceAdjs = await prisma.monthlyAdjustment.findMany({
      where: { academyId, billingMonth: sourceMonth },
    });

    if (sourceAdjs.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, sourceMonth });
    }

    // 이번 달 기존 항목을 미리 로드해 Set으로 변환 (O(1) 중복 체크)
    const existingAdjs = await prisma.monthlyAdjustment.findMany({
      where: { academyId, billingMonth: targetMonth },
      select: { scope: true, classId: true, studentId: true, label: true, direction: true, amount: true },
    });

    // 5-필드 조합 키: scope|classId|studentId|label|direction|amount
    const existingKeys = new Set(
      existingAdjs.map(
        (a) => `${a.scope}|${a.classId ?? ''}|${a.studentId ?? ''}|${a.label}|${a.direction}|${a.amount}`,
      ),
    );

    let created = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx) => {
      for (const src of sourceAdjs) {
        const key = `${src.scope}|${src.classId ?? ''}|${src.studentId ?? ''}|${src.label}|${src.direction}|${src.amount}`;

        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        // 원본의 classId/studentId가 아직 유효한지 확인 (삭제된 경우 건너뜀)
        if (src.scope === 'class' && src.classId) {
          const cls = await tx.class.findUnique({ where: { id: src.classId }, select: { academyId: true } });
          if (!cls || cls.academyId !== academyId) { skipped++; continue; }
        }
        if (src.scope === 'student' && src.studentId) {
          const student = await tx.student.findUnique({ where: { id: src.studentId }, select: { academyId: true } });
          if (!student || student.academyId !== academyId) { skipped++; continue; }
        }

        await tx.monthlyAdjustment.create({
          data: {
            academyId,
            billingMonth: targetMonth,
            scope: src.scope,
            classId: src.classId,
            studentId: src.studentId,
            label: src.label,
            direction: src.direction,
            amount: src.amount,
            memo: src.memo,
          },
        });

        existingKeys.add(key); // 트랜잭션 내 재중복 방지
        created++;
      }
    });

    // 복사된 항목이 있으면 이번 달 활성 청구서 전체 재계산
    if (created > 0) {
      const bills = await prisma.bill.findMany({
        where: {
          academyId,
          month: targetMonth,
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        select: { id: true },
      });
      await Promise.all(bills.map((b) => calculateBillWithAdjustments(b.id)));
    }

    return NextResponse.json({ created, skipped, sourceMonth, targetMonth });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/finance/adjustments/monthly/copy-last-month]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
