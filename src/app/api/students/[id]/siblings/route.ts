import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// POST /api/students/[id]/siblings — 형제/자매 목록 전체 교체 (sync)
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const academyId = req.headers.get('x-academy-id');
    if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { siblingIds } = await req.json() as { siblingIds: string[] };
    if (!Array.isArray(siblingIds)) {
      return NextResponse.json({ error: 'siblingIds must be an array' }, { status: 400 });
    }

    // 학원 소속 검증
    const student = await prisma.student.findFirst({ where: { id, academyId } });
    if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // 기존 링크 전체 삭제 (양방향)
      await tx.studentSibling.deleteMany({
        where: { OR: [{ studentAId: id }, { studentBId: id }] },
      });

      // 새 링크 생성 (중복 방지: 항상 id < siblingId 순으로 저장)
      const pairs = siblingIds.map((sibId) =>
        id < sibId
          ? { studentAId: id, studentBId: sibId }
          : { studentAId: sibId, studentBId: id },
      );
      // 중복 제거
      const unique = pairs.filter(
        (p, i, arr) => arr.findIndex((x) => x.studentAId === p.studentAId && x.studentBId === p.studentBId) === i,
      );
      if (unique.length > 0) {
        await tx.studentSibling.createMany({ data: unique, skipDuplicates: true });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/students/[id]/siblings]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
