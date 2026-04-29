import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// PATCH /api/communication/inquiries/[id] — 상태·메모 업데이트
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const { status, memo } = body;

  const VALID_STATUSES = ['NEW', 'READ', 'REPLIED'];
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: '잘못된 status 값입니다.' }, { status: 400 });
  }

  try {
    const existing = await prisma.publicInquiry.findUnique({ where: { id }, select: { academyId: true } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '찾을 수 없습니다.' }, { status: 404 });
    }

    const updated = await prisma.publicInquiry.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(memo   !== undefined && { memo }),
      },
    });

    return NextResponse.json({
      id:        updated.id,
      name:      updated.name,
      phone:     updated.phone,
      classId:   updated.classId,
      className: updated.className,
      message:   updated.message,
      status:    updated.status,
      memo:      updated.memo,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error('[PATCH /api/communication/inquiries/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
