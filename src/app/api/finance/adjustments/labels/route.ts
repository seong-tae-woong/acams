import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

/**
 * GET  /api/finance/adjustments/labels   — 학원의 조정 명칭 목록 조회
 * POST /api/finance/adjustments/labels   — 신규 명칭 등록 (예: "교재비", "활동비")
 *
 * 월별 조정 추가 시 드롭다운에 표시할 명칭 사전.
 * - 중복 시 idempotent (이미 있으면 기존 행 반환)
 * - 명칭은 학원 내 유니크
 */

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'super_admin' && role !== 'teacher') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  try {
    const labels = await prisma.adjustmentLabel.findMany({
      where: { academyId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(labels);
  } catch (err) {
    console.error('[GET /api/finance/adjustments/labels]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json() as { name?: string };
    const name = body.name?.trim() ?? '';
    if (!name) {
      return NextResponse.json({ error: 'name은 필수입니다.' }, { status: 400 });
    }
    if (name.length > 30) {
      return NextResponse.json({ error: '명칭은 30자 이내여야 합니다.' }, { status: 400 });
    }

    // 중복 시 idempotent
    const existing = await prisma.adjustmentLabel.findUnique({
      where: { academyId_name: { academyId, name } },
    });
    if (existing) return NextResponse.json(existing, { status: 200 });

    const created = await prisma.adjustmentLabel.create({
      data: { academyId, name },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[POST /api/finance/adjustments/labels]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
