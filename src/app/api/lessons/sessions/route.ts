import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/lessons/sessions?classId=&from=YYYY-MM-DD&to=YYYY-MM-DD
// ClassSchedule(반복) + ClassEvent(일회성)을 합쳐 from~to 사이의 모든 수업 일자를 반환
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId') || undefined;
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: 'from, to 파라미터 필수' }, { status: 400 });
  }

  const from = new Date(`${fromStr}T00:00:00.000Z`);
  const to = new Date(`${toStr}T23:59:59.999Z`);

  try {
    const classes = await prisma.class.findMany({
      where: {
        academyId,
        isActive: true,
        ...(classId ? { id: classId } : {}),
      },
      include: { schedules: true },
    });

    const events = await prisma.classEvent.findMany({
      where: {
        academyId,
        date: { gte: from, lte: to },
        ...(classId ? { classId } : {}),
      },
    });

    type Session = {
      classId: string;
      className: string;
      date: string;
      startTime: string;
      endTime: string;
      isOneTime: boolean;
      color: string;
    };

    const sessions: Session[] = [];

    // 정규 반복 수업 전개
    for (const cls of classes) {
      for (const sch of cls.schedules) {
        const cursor = new Date(from);
        while (cursor <= to) {
          const jsDay = cursor.getUTCDay();
          const dow = jsDay === 0 ? 7 : jsDay; // 1=Mon ~ 7=Sun
          if (dow === sch.dayOfWeek) {
            sessions.push({
              classId: cls.id,
              className: cls.name,
              date: cursor.toISOString().slice(0, 10),
              startTime: sch.startTime,
              endTime: sch.endTime,
              isOneTime: false,
              color: cls.color,
            });
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }
    }

    // 일회성 수업 추가
    const classMap = new Map(classes.map((c) => [c.id, c]));
    for (const ev of events) {
      const cls = classMap.get(ev.classId);
      if (!cls) continue;
      sessions.push({
        classId: ev.classId,
        className: cls.name,
        date: ev.date.toISOString().slice(0, 10),
        startTime: ev.startTime,
        endTime: ev.endTime,
        isOneTime: true,
        color: cls.color,
      });
    }

    sessions.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    return NextResponse.json(sessions);
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/lessons/sessions]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
