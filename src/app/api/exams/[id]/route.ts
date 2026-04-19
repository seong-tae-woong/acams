import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/exams/[id] — 시험 삭제 (연결된 성적 레코드도 함께 삭제)
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    // 소유권 확인
    const exam = await prisma.exam.findFirst({ where: { id, academyId } });
    if (!exam) return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });

    await prisma.$transaction([
      prisma.gradeRecord.deleteMany({ where: { examId: id } }),
      prisma.exam.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/exams/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
