import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// DateTime → 'YYYY-MM-DD' (KST 기준)
function toDateStr(d: Date): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(d);
}

function mapEvent(e: { id: string; classId: string; date: Date; startTime: string; endTime: string }) {
  return {
    id: e.id,
    classId: e.classId,
    date: toDateStr(e.date),
    startTime: e.startTime,
    endTime: e.endTime,
  };
}

// GET /api/class-events — 학원의 모든 일회성 수업 일정
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const events = await prisma.classEvent.findMany({
      where: { academyId },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json(events.map(mapEvent));
  } catch (err) {
    console.error('[GET /api/class-events]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/class-events — body: { classId, date, startTime, endTime }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const { classId, date, startTime, endTime } = await req.json();
    if (!classId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'classId, date, startTime, endTime는 필수입니다.' }, { status: 400 });
    }

    // 반이 같은 학원 소속인지 검증 (멀티테넌트 보안)
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { academyId: true } });
    if (!cls || cls.academyId !== academyId) {
      return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });
    }

    const event = await prisma.classEvent.create({
      data: { academyId, classId, date: new Date(date), startTime, endTime },
    });
    return NextResponse.json(mapEvent(event), { status: 201 });
  } catch (err) {
    console.error('[POST /api/class-events]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
