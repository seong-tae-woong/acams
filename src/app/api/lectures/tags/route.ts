import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const VALID_TYPES = ['subject', 'level', 'grade', 'etc'] as const;
type TagType = (typeof VALID_TYPES)[number];

// GET /api/lectures/tags  — 현재 학원의 커스텀 태그 목록
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tags = await prisma.academyTag.findMany({
      where: { academyId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(tags);
  } catch (err) {
    console.error('[GET /api/lectures/tags]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/lectures/tags  — 커스텀 태그 추가
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { label, tagType } = await req.json();

    if (!label?.trim()) return NextResponse.json({ error: '태그 이름을 입력해주세요.' }, { status: 400 });
    if (!VALID_TYPES.includes(tagType as TagType)) {
      return NextResponse.json({ error: '올바른 태그 종류를 지정해주세요.' }, { status: 400 });
    }

    const tag = await prisma.academyTag.create({
      data: { academyId, label: label.trim(), tagType },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (err: unknown) {
    // Prisma unique constraint violation (P2002) = 이미 존재하는 태그
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: '이미 존재하는 태그입니다.' }, { status: 409 });
    }
    console.error('[POST /api/lectures/tags]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
