import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/exam-categories/[id]
// - 하위 카테고리(children)도 함께 삭제
// - 이 카테고리를 사용하는 시험의 해당 슬롯은 null로 끊음
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const target = await prisma.examCategory.findFirst({ where: { id, academyId } });
    if (!target) return NextResponse.json({ error: '카테고리를 찾을 수 없습니다.' }, { status: 404 });

    // 모든 후손 id 수집
    const all = await prisma.examCategory.findMany({
      where: { academyId },
      select: { id: true, parentId: true },
    });
    const childMap = new Map<string | null, string[]>();
    for (const r of all) {
      const list = childMap.get(r.parentId) ?? [];
      list.push(r.id);
      childMap.set(r.parentId, list);
    }
    const toDelete: string[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      toDelete.push(cur);
      const kids = childMap.get(cur) ?? [];
      stack.push(...kids);
    }

    await prisma.$transaction([
      prisma.exam.updateMany({ where: { academyId, category1Id: { in: toDelete } }, data: { category1Id: null } }),
      prisma.exam.updateMany({ where: { academyId, category2Id: { in: toDelete } }, data: { category2Id: null } }),
      prisma.exam.updateMany({ where: { academyId, category3Id: { in: toDelete } }, data: { category3Id: null } }),
      prisma.examCategory.deleteMany({ where: { id: { in: toDelete }, academyId } }),
    ]);

    return NextResponse.json({ ok: true, deleted: toDelete.length });
  } catch (err) {
    console.error('[DELETE /api/exam-categories/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
