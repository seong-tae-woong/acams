import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { BillStatus as PrismaBS } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';

/**
 * POST /api/finance/bills/draft-confirm
 * 원장 전용 — DRAFT 청구서를 UNPAID로 확정 (부분 선택 가능)
 *
 * Body: { billIds: string[] }
 *
 * - billIds에 포함된 청구서가 DRAFT 상태인지 검증
 * - 이 학원 소속인지 검증
 * - status DRAFT → UNPAID 일괄 전환
 * - 금액은 이미 calculateBillWithAdjustments로 반영되어 있으므로 재계산 불필요
 *
 * Response: { confirmed: number, billIds: string[] }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { billIds } = body as { billIds?: string[] };

    if (!Array.isArray(billIds) || billIds.length === 0) {
      return NextResponse.json({ error: 'billIds는 필수입니다.' }, { status: 400 });
    }

    // 대상 청구서 일괄 조회
    const bills = await prisma.bill.findMany({
      where: { id: { in: billIds }, academyId },
      select: { id: true, status: true },
    });

    if (bills.length !== billIds.length) {
      return NextResponse.json(
        { error: '유효하지 않은 청구서가 포함되어 있습니다.' },
        { status: 400 },
      );
    }

    const nonDraft = bills.filter((b) => b.status !== PrismaBS.DRAFT);
    if (nonDraft.length > 0) {
      return NextResponse.json(
        { error: `DRAFT 상태가 아닌 청구서가 포함되어 있습니다. (${nonDraft.length}건)` },
        { status: 400 },
      );
    }

    // DRAFT → UNPAID 일괄 전환
    const result = await prisma.bill.updateMany({
      where: { id: { in: billIds }, academyId, status: PrismaBS.DRAFT },
      data: { status: PrismaBS.UNPAID },
    });

    return NextResponse.json({ confirmed: result.count, billIds });
  } catch (err) {
    console.error('[POST /api/finance/bills/draft-confirm]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
