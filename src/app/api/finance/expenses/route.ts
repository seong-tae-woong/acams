import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function mapExpense(e: {
  id: string; category: string; description: string;
  amount: number; date: Date; memo: string;
}) {
  return {
    id: e.id,
    category: e.category,
    description: e.description,
    amount: e.amount,
    date: e.date.toISOString().slice(0, 10),
    memo: e.memo,
  };
}

// GET /api/finance/expenses?month=YYYY-MM
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');

  try {
    const expenses = await prisma.expense.findMany({
      where: {
        academyId,
        ...(month
          ? {
              date: {
                gte: new Date(`${month}-01`),
                lt: new Date(
                  month.slice(0, 4) + '-' +
                  String(parseInt(month.slice(5, 7)) + 1).padStart(2, '0') + '-01'
                ),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(expenses.map(mapExpense));
  } catch (err) {
    console.error('[GET /api/finance/expenses]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/finance/expenses
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { category, description, amount, date, memo } = await req.json();

    if (!category || !amount || !date) {
      return NextResponse.json({ error: '분류, 금액, 날짜는 필수입니다.' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        academyId,
        category,
        description: description ?? '',
        amount,
        date: new Date(date),
        memo: memo ?? '',
      },
    });

    return NextResponse.json(mapExpense(expense), { status: 201 });
  } catch (err) {
    console.error('[POST /api/finance/expenses]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
