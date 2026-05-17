import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/grades/[id] — 점수·순위·코멘트 수정
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const existing = await prisma.gradeRecord.findFirst({ where: { id, academyId } });
    if (!existing) return NextResponse.json({ error: '성적 레코드를 찾을 수 없습니다.' }, { status: 404 });

    const { score, rank, memo } = await req.json();

    const updated = await prisma.gradeRecord.update({
      where: { id },
      data: {
        ...(score !== undefined ? { score } : {}),
        ...(rank !== undefined ? { rank } : {}),
        ...(memo !== undefined ? { memo } : {}),
      },
      include: { student: { select: { name: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      examId: updated.examId,
      studentId: updated.studentId,
      studentName: updated.student.name,
      score: updated.score,
      rank: updated.rank,
      memo: updated.memo,
    });
  } catch (err) {
    console.error('[PATCH /api/grades/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
