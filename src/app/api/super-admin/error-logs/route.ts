import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// 슈퍼어드민 전용 — proxy.ts에서 토큰 검증 후 x-user-role 헤더 주입됨
function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

// GET /api/super-admin/error-logs?resolved=false&academyId=&limit=200
// 서버 에러 진단 로그 — 어느 학원/누가/무슨 에러인지. 최신순.
export async function GET(req: NextRequest) {
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const resolvedParam = searchParams.get('resolved'); // 'true' | 'false' | null(전체)
  const academyId = searchParams.get('academyId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10) || 200, 500);

  const logs = await prisma.errorLog.findMany({
    where: {
      ...(resolvedParam === 'true'
        ? { resolved: true }
        : resolvedParam === 'false'
        ? { resolved: false }
        : {}),
      ...(academyId ? { academyId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // academyId → 학원명 매핑 (FK가 아니므로 별도 배치 조회)
  const ids = [...new Set(logs.map((l) => l.academyId).filter((v): v is string => !!v))];
  const academies = ids.length
    ? await prisma.academy.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(academies.map((a) => [a.id, a.name]));

  const unresolvedCount = await prisma.errorLog.count({ where: { resolved: false } });

  return NextResponse.json({
    logs: logs.map((l) => ({
      ...l,
      academyName: l.academyId ? nameById.get(l.academyId) ?? null : null,
    })),
    unresolvedCount,
  });
}
