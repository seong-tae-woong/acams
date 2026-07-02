import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// DELETE /api/question-bank/presets/[id] — 프리셋 삭제(academyId 스코프)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    // deleteMany + academyId 스코프 — 타 학원 프리셋은 count 0 → 404
    const result = await prisma.testPreset.deleteMany({ where: { id, academyId } });
    if (result.count === 0) {
      return NextResponse.json({ error: '프리셋을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    await logServerError(req, err);
    console.error(
      '[DELETE /api/question-bank/presets/[id]]',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
