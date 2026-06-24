import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/exams/[id] — 시험 수정
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const exam = await prisma.exam.findFirst({ where: { id, academyId } });
    if (!exam) return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });

    const {
      name, date, totalScore, totalQuestions, description,
      category1Id, category2Id, category3Id,
    } = await req.json();

    if (!name || !date) return NextResponse.json({ error: '시험명과 날짜는 필수입니다.' }, { status: 400 });
    if (!category1Id) return NextResponse.json({ error: '카테고리 1은 필수입니다.' }, { status: 400 });

    // 배점 방식은 생성 후 변경 불가(잠금) — exam.scoringMethod를 그대로 유지
    // COUNT 방식이면 총 문제 수를 수정할 수 있고, 바뀌면 기존 성적의 환산 점수를 재계산
    let newTotalScore = exam.totalScore;
    let newTotalQuestions = exam.totalQuestions;
    let recomputeScores = false;
    if (exam.scoringMethod === 'COUNT') {
      const tq = Number(totalQuestions);
      if (!Number.isInteger(tq) || tq < 1) {
        return NextResponse.json({ error: '총 문제 수는 1 이상이어야 합니다.' }, { status: 400 });
      }
      newTotalScore = 100;
      if (tq !== exam.totalQuestions) {
        newTotalQuestions = tq;
        recomputeScores = true;
      }
    } else {
      newTotalScore = totalScore ?? exam.totalScore;
    }

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
        totalScore: newTotalScore,
        totalQuestions: newTotalQuestions,
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

    // 총 문제 수가 바뀐 COUNT 시험은 기존 성적의 100점 환산값을 재계산
    // (모든 점수가 동일 비율로 스케일되므로 순위는 그대로 유지됨)
    if (recomputeScores && newTotalQuestions) {
      const recs = await prisma.gradeRecord.findMany({
        where: { examId: id, correctCount: { not: null } },
        select: { id: true, correctCount: true },
      });
      if (recs.length > 0) {
        await prisma.$transaction(
          recs.map((r) =>
            prisma.gradeRecord.update({
              where: { id: r.id },
              data: { score: Math.round((r.correctCount! / newTotalQuestions) * 100) },
            }),
          ),
        );
      }
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      subject: updated.subject,
      classId: updated.classId,
      className: updated.class?.name ?? '',
      date: updated.date.toISOString().slice(0, 10),
      totalScore: updated.totalScore,
      scoringMethod: updated.scoringMethod,
      totalQuestions: updated.totalQuestions,
      description: updated.description,
      category1Id: updated.category1?.id ?? null,
      category1Name: updated.category1?.name ?? null,
      category2Id: updated.category2?.id ?? null,
      category2Name: updated.category2?.name ?? null,
      category3Id: updated.category3?.id ?? null,
      category3Name: updated.category3?.name ?? null,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[PATCH /api/exams/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/exams/[id] — 시험 삭제 (연결된 성적 레코드도 함께 삭제)
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

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
    await logServerError(req, err);
    console.error('[DELETE /api/exams/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
