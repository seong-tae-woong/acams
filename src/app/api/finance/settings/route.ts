import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { resyncAllSiblingDiscounts } from '@/lib/utils/billing';

// 청구 관련 학원 설정 (형제 할인 자동 적용).
// /api/finance/* 는 proxy에서 manageFinance(재무 관리) 권한으로 게이트됨 —
// 학원 공개 프로필/사업자 정보를 다루는 /api/settings/academy(원장 전용)와 분리해
// 재무 관리 권한 강사도 형제 할인을 수정할 수 있게 한다.

// GET /api/finance/settings
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { siblingDiscountDefault: true, siblingDiscountType: true },
    });
    if (!academy) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json(academy);
  } catch (err) {
    console.error('[GET /api/finance/settings]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/finance/settings — 형제 할인 저장 + 재원생 전체 재동기화
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const { siblingDiscountDefault, siblingDiscountType } = await req.json();

    const data: { siblingDiscountDefault?: number; siblingDiscountType?: 'fixed' | 'percent' } = {};
    if (typeof siblingDiscountDefault === 'number' && siblingDiscountDefault >= 0) {
      data.siblingDiscountDefault = Math.round(siblingDiscountDefault);
    }
    if (siblingDiscountType === 'fixed' || siblingDiscountType === 'percent') {
      data.siblingDiscountType = siblingDiscountType;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '변경할 값이 없습니다.' }, { status: 400 });
    }
    if (data.siblingDiscountType === 'percent' && (data.siblingDiscountDefault ?? 0) > 100) {
      return NextResponse.json({ error: '퍼센트 할인은 100을 초과할 수 없습니다.' }, { status: 400 });
    }

    await prisma.academy.update({ where: { id: academyId }, data });

    // 형제 할인 설정 변경 → 영향 받는 재원생만 추려 제한 동시성으로 재동기화
    await resyncAllSiblingDiscounts(academyId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/finance/settings]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
