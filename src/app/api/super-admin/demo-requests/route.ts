import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// 슈퍼어드민 전용 — proxy.ts에서 role 체크 후 x-user-role 헤더 주입됨
function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

// GET /api/super-admin/demo-requests — 마케팅 상담 신청 전체 목록
export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requests = await prisma.demoRequest.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(requests);
}
