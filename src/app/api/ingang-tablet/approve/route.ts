/**
 * POST /api/ingang-tablet/approve
 *
 * 강사가 일일 인증 코드 + (선택) classId를 입력해 학생 시청 요청을 승인.
 * role=tablet 전용 (태블릿에서 강사가 코드를 입력하는 방식).
 *
 * body: { sessionId, dailyCode, classId? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export async function POST(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  const academyId = req.headers.get('x-academy-id');
  const tabletUserId = req.headers.get('x-user-id');

  if (role !== 'tablet' || !academyId || !tabletUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, dailyCode, classId } = await req.json();

    if (!sessionId || !dailyCode) {
      return NextResponse.json({ error: 'sessionId와 인증 코드가 필요합니다.' }, { status: 400 });
    }

    // 세션 확인
    const session = await prisma.ingangViewSession.findFirst({
      where: { id: sessionId, academyId, status: 'PENDING' },
    });
    if (!session) {
      return NextResponse.json({ error: '유효하지 않은 요청입니다. 출결번호를 다시 입력해주세요.' }, { status: 404 });
    }

    // 오늘 코드 확인
    const todayCode = await prisma.ingangDailyCode.findUnique({
      where: { academyId_date: { academyId, date: todayUTC() } },
    });
    if (!todayCode || todayCode.code !== dailyCode.trim()) {
      return NextResponse.json({ error: '인증 코드가 올바르지 않습니다.' }, { status: 400 });
    }

    // 세션 승인 처리
    const approved = await prisma.ingangViewSession.update({
      where: { id: sessionId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: tabletUserId,
        classId: classId ?? null,
      },
    });

    return NextResponse.json({ success: true, sessionId: approved.id, classId: approved.classId });
  } catch (err) {
    console.error('[POST /api/ingang-tablet/approve]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
