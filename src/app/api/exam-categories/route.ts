import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/exam-categories — 학원의 시험 카테고리 전체 목록 (level 1/2/3 평탄)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const rows = await prisma.examCategory.findMany({
      where: { academyId },
      orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, level: true, parentId: true },
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[GET /api/exam-categories]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/exam-categories — 카테고리 등록
// body: { name, level: 1|2|3, parentId?: string }
// 규칙: level 1은 parentId null, level 2는 parentId의 level이 1이어야 함, level 3은 2.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const { name, level, parentId } = await req.json();
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    if (![1, 2, 3].includes(level)) return NextResponse.json({ error: 'level은 1, 2, 3 중 하나여야 합니다.' }, { status: 400 });

    if (level === 1) {
      if (parentId) return NextResponse.json({ error: '카테고리 1은 상위가 없어야 합니다.' }, { status: 400 });
    } else {
      if (!parentId) return NextResponse.json({ error: '상위 카테고리를 선택해주세요.' }, { status: 400 });
      const parent = await prisma.examCategory.findFirst({ where: { id: parentId, academyId } });
      if (!parent) return NextResponse.json({ error: '상위 카테고리를 찾을 수 없습니다.' }, { status: 404 });
      if (parent.level !== level - 1) {
        return NextResponse.json({ error: '카테고리 계층이 올바르지 않습니다.' }, { status: 400 });
      }
    }

    const created = await prisma.examCategory.create({
      data: {
        academyId,
        name: trimmed,
        level,
        parentId: level === 1 ? null : parentId,
      },
      select: { id: true, name: true, level: true, parentId: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[POST /api/exam-categories]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
