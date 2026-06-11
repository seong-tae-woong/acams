import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// DELETE /api/finance/adjustments/labels/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const label = await prisma.adjustmentLabel.findUnique({
      where: { id },
      select: { academyId: true },
    });
    if (!label || label.academyId !== academyId) {
      return NextResponse.json({ error: '명칭을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.adjustmentLabel.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/finance/adjustments/labels/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
