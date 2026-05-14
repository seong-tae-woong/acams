/**
 * /api/ingang-tablet/daily-code
 *
 * GET  — 오늘 인증 코드 조회 (없으면 자동 발급). tablet·teacher·director 모두 허용.
 * POST — 코드 즉시 재발급 (강사 "새 코드" 버튼). teacher·director만 허용.
 *
 * 모든 요청은 JWT(x-user-role, x-academy-id, x-user-id)를 통해 인증됨.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getOrCreate(academyId: string, userId: string): Promise<string> {
  const date = todayUTC();
  const existing = await prisma.ingangDailyCode.findUnique({
    where: { academyId_date: { academyId, date } },
  });
  if (existing) return existing.code;

  const code = randomCode();
  await prisma.ingangDailyCode.create({ data: { academyId, date, code, createdBy: userId } });
  return code;
}

// GET — 오늘 코드 조회 (없으면 자동 발급)
export async function GET(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  if (!academyId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['tablet', 'teacher', 'director'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const code = await getOrCreate(academyId, userId);
    return NextResponse.json({ code, date: todayUTC().toISOString() });
  } catch (err) {
    console.error('[GET /api/ingang-tablet/daily-code]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST — 코드 즉시 재발급 (강사/원장 전용)
export async function POST(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  if (!academyId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['teacher', 'director'].includes(role ?? '')) {
    return NextResponse.json({ error: '강사 또는 원장만 코드를 재발급할 수 있습니다.' }, { status: 403 });
  }

  const date = todayUTC();
  const code = randomCode();

  try {
    await prisma.ingangDailyCode.upsert({
      where: { academyId_date: { academyId, date } },
      create: { academyId, date, code, createdBy: userId },
      update: { code, createdBy: userId, createdAt: new Date() },
    });

    return NextResponse.json({ code, date: date.toISOString() });
  } catch (err) {
    console.error('[POST /api/ingang-tablet/daily-code]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
