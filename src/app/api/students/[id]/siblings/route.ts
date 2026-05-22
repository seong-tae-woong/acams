import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { syncSiblingDiscountsForStudent } from '@/lib/utils/billing';

// POST /api/students/[id]/siblings — 형제/자매 목록 전체 교체 (sync)
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { academyId, role } = auth;
    if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
      return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
    }

    const { siblingIds } = await req.json() as { siblingIds: string[] };
    if (!Array.isArray(siblingIds)) {
      return NextResponse.json({ error: 'siblingIds must be an array' }, { status: 400 });
    }

    // 학원 소속 검증
    const student = await prisma.student.findFirst({ where: { id, academyId } });
    if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });

    // sync 대상: 기존 형제 + 새 형제 (변경된 양쪽 모두 재평가 필요)
    const prevLinks = await prisma.studentSibling.findMany({
      where: { OR: [{ studentAId: id }, { studentBId: id }] },
      select: { studentAId: true, studentBId: true },
    });
    const prevSiblings = prevLinks.map((l) => (l.studentAId === id ? l.studentBId : l.studentAId));
    const affectedIds = new Set<string>([id, ...prevSiblings, ...siblingIds]);

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

      // 영향 받은 학생 전원에 대해 형제 할인 자동 동기화
      for (const sid of affectedIds) {
        await syncSiblingDiscountsForStudent(sid, tx);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/students/[id]/siblings]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
