import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

const VALID_STATUS = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'] as const;
type DemoStatus = (typeof VALID_STATUS)[number];

// PATCH /api/super-admin/demo-requests/[id] — 상태·메모 업데이트
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const { status, memo } = await req.json();

    const data: { status?: DemoStatus; memo?: string } = {};
    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json({ error: '잘못된 상태값입니다.' }, { status: 400 });
      }
      data.status = status;
    }
    if (memo !== undefined) {
      data.memo = String(memo);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 });
    }

    const updated = await prisma.demoRequest.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PATCH /api/super-admin/demo-requests/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
