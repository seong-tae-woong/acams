import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/exams/[id] — 시험 수정
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const exam = await prisma.exam.findFirst({ where: { id, academyId } });
    if (!exam) return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });

    const {
      name, date, totalScore, description,
      category1Id, category2Id, category3Id,
    } = await req.json();

    if (!name || !date) return NextResponse.json({ error: '시험명과 날짜는 필수입니다.' }, { status: 400 });
    if (!category1Id) return NextResponse.json({ error: '카테고리 1은 필수입니다.' }, { status: 400 });

    // 카테고리 소유권/계층 검증 (POST와 동일)
    const ids = [category1Id, category2Id, category3Id].filter(Boolean) as string[];
    const cats = await prisma.examCategory.findMany({
      where: { id: { in: ids }, academyId },
      select: { id: true, level: true, parentId: true },
    });
    const byId = new Map(cats.map((c) => [c.id, c]));

    const c1 = byId.get(category1Id);
    if (!c1 || c1.level !== 1) return NextResponse.json({ error: '카테고리 1이 올바르지 않습니다.' }, { status: 400 });

    if (category2Id) {
      const c2 = byId.get(category2Id);
      if (!c2 || c2.level !== 2 || c2.parentId !== category1Id) {
        return NextResponse.json({ error: '카테고리 2가 올바르지 않습니다.' }, { status: 400 });
      }
    }
    if (category3Id) {
      if (!category2Id) return NextResponse.json({ error: '카테고리 3은 카테고리 2가 있어야 선택할 수 있습니다.' }, { status: 400 });
      const c3 = byId.get(category3Id);
      if (!c3 || c3.level !== 3 || c3.parentId !== category2Id) {
        return NextResponse.json({ error: '카테고리 3이 올바르지 않습니다.' }, { status: 400 });
      }
    }

    const updated = await prisma.exam.update({
      where: { id },
      data: {
        name,
        date: new Date(date),
        totalScore: totalScore ?? exam.totalScore,
        description: description ?? '',
        category1Id,
        category2Id: category2Id ?? null,
        category3Id: category3Id ?? null,
      },
      include: {
        class: { select: { name: true } },
        category1: { select: { id: true, name: true } },
        category2: { select: { id: true, name: true } },
        category3: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      subject: updated.subject,
      classId: updated.classId,
      className: updated.class.name,
      date: updated.date.toISOString().slice(0, 10),
      totalScore: updated.totalScore,
      description: updated.description,
      category1Id: updated.category1?.id ?? null,
      category1Name: updated.category1?.name ?? null,
      category2Id: updated.category2?.id ?? null,
      category2Name: updated.category2?.name ?? null,
      category3Id: updated.category3?.id ?? null,
      category3Name: updated.category3?.name ?? null,
    });
  } catch (err) {
    console.error('[PATCH /api/exams/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

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
