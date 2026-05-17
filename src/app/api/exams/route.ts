import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { sendPushToClass } from '@/lib/push/sendPush';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/exams?classId=xxx — 반별 시험 목록
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const category1Id = searchParams.get('category1Id');
  const category2Id = searchParams.get('category2Id');
  const category3Id = searchParams.get('category3Id');
  const takeParam = searchParams.get('take');
  const skipParam = searchParams.get('skip');
  // take 파라미터가 있으면 등록일(createdAt) 최신순 페이지네이션, 없으면 기존 전체 조회
  const take = takeParam ? Math.max(1, Math.min(100, Number(takeParam) || 0)) : undefined;
  const skip = skipParam ? Math.max(0, Number(skipParam) || 0) : 0;

  try {
    const exams = await prisma.exam.findMany({
      where: {
        academyId,
        ...(classId ? { classId } : {}),
        ...(category1Id ? { category1Id } : {}),
        ...(category2Id ? { category2Id } : {}),
        ...(category3Id ? { category3Id } : {}),
      },
      include: {
        class: { select: { name: true, subject: true } },
        category1: { select: { id: true, name: true } },
        category2: { select: { id: true, name: true } },
        category3: { select: { id: true, name: true } },
      },
      orderBy: take !== undefined ? { createdAt: 'desc' } : { date: 'desc' },
      ...(take !== undefined ? { take, skip } : {}),
    });

    const result = exams.map((e) => ({
      id: e.id,
      name: e.name,
      subject: e.subject,
      classId: e.classId,
      className: e.class.name,
      date: e.date.toISOString().slice(0, 10),
      totalScore: e.totalScore,
      description: e.description,
      category1Id: e.category1?.id ?? null,
      category1Name: e.category1?.name ?? null,
      category2Id: e.category2?.id ?? null,
      category2Name: e.category2?.name ?? null,
      category3Id: e.category3?.id ?? null,
      category3Name: e.category3?.name ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/exams]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/exams — 시험 등록
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const {
      name, subject, classId, date, totalScore, description,
      category1Id, category2Id, category3Id,
    } = await req.json();

    if (!name || !classId || !date) {
      return NextResponse.json({ error: '시험명, 반, 날짜는 필수입니다.' }, { status: 400 });
    }
    if (!category1Id) {
      return NextResponse.json({ error: '카테고리 1은 필수입니다.' }, { status: 400 });
    }

    // 카테고리 소유권/계층 검증
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

    const exam = await prisma.exam.create({
      data: {
        academyId,
        classId,
        name,
        subject: subject ?? '',
        date: new Date(date),
        totalScore: totalScore ?? 100,
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

    void sendPushToClass(exam.classId, {
      title: `${exam.class.name} 시험 등록`,
      body: `${exam.name} (${exam.date.toISOString().slice(0, 10)})`,
      url: '/mobile/grades',
      tag: `exam-${exam.id}`,
    });

    return NextResponse.json({
      id: exam.id,
      name: exam.name,
      subject: exam.subject,
      classId: exam.classId,
      className: exam.class.name,
      date: exam.date.toISOString().slice(0, 10),
      totalScore: exam.totalScore,
      description: exam.description,
      category1Id: exam.category1?.id ?? null,
      category1Name: exam.category1?.name ?? null,
      category2Id: exam.category2?.id ?? null,
      category2Name: exam.category2?.name ?? null,
      category3Id: exam.category3?.id ?? null,
      category3Name: exam.category3?.name ?? null,
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/exams]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
