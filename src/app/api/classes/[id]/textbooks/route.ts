import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function mapTextbook(tb: {
  id: string; classId: string; name: string; publisher: string; unit: string;
  totalUnits: number; currentUnit: number; price: number; isbn: string;
  purchaseDate: Date | null; memo: string;
}) {
  return {
    id: tb.id,
    classId: tb.classId,
    name: tb.name,
    publisher: tb.publisher,
    unit: tb.unit,
    totalUnits: tb.totalUnits,
    currentUnit: tb.currentUnit,
    price: tb.price,
    isbn: tb.isbn,
    purchaseDate: tb.purchaseDate ? tb.purchaseDate.toISOString().slice(0, 10) : '',
    memo: tb.memo,
  };
}

// GET /api/classes/[id]/textbooks
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: classId } = await ctx.params;

  try {
    const textbooks = await prisma.textbook.findMany({
      where: { academyId, classId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(textbooks.map(mapTextbook));
  } catch (err) {
    console.error('[GET /api/classes/[id]/textbooks]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/classes/[id]/textbooks
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: classId } = await ctx.params;

  try {
    const { name, publisher, unit, totalUnits, currentUnit, price, isbn, purchaseDate, memo } = await req.json();
    if (!name) return NextResponse.json({ error: '교재명은 필수입니다.' }, { status: 400 });

    const tb = await prisma.textbook.create({
      data: {
        academyId,
        classId,
        name,
        publisher: publisher ?? '',
        unit: unit ?? '권',
        totalUnits: totalUnits ?? 1,
        currentUnit: currentUnit ?? 1,
        price: price ?? 0,
        isbn: isbn ?? '',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        memo: memo ?? '',
      },
    });

    return NextResponse.json(mapTextbook(tb), { status: 201 });
  } catch (err) {
    console.error('[POST /api/classes/[id]/textbooks]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
