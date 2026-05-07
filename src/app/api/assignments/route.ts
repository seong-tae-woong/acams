import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { sendPushToClass } from '@/lib/push/sendPush';

// GET /api/assignments?classId=xxx — 반별 과제 목록
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');

  try {
    const assignments = await prisma.assignment.findMany({
      where: {
        academyId,
        ...(classId ? { classId } : {}),
      },
      include: { class: { select: { name: true, subject: true } } },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(assignments.map((a) => ({
      id: a.id,
      classId: a.classId,
      className: a.class.name,
      classSubject: a.class.subject,
      date: a.date.toISOString().slice(0, 10),
      dueDate: a.dueDate.toISOString().slice(0, 10),
      memo: a.memo,
    })));
  } catch (err) {
    console.error('[GET /api/assignments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/assignments — 과제 등록
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { classId, date, dueDate, memo } = await req.json();
    if (!classId || !date || !dueDate) {
      return NextResponse.json({ error: '반·일자·납기일은 필수입니다.' }, { status: 400 });
    }

    const cls = await prisma.class.findFirst({ where: { id: classId, academyId } });
    if (!cls) return NextResponse.json({ error: '반을 찾을 수 없습니다.' }, { status: 404 });

    const created = await prisma.assignment.create({
      data: {
        academyId,
        classId,
        date: new Date(date),
        dueDate: new Date(dueDate),
        memo: memo ?? '',
      },
      include: { class: { select: { name: true, subject: true } } },
    });

    void sendPushToClass(created.classId, {
      title: `${created.class.name} 숙제 등록`,
      body: created.memo
        ? `${created.memo.slice(0, 60)} (~${created.dueDate.toISOString().slice(0, 10)})`
        : `납기일 ${created.dueDate.toISOString().slice(0, 10)}`,
      url: '/mobile/schedule',
      tag: `assignment-${created.id}`,
    });

    return NextResponse.json({
      id: created.id,
      classId: created.classId,
      className: created.class.name,
      classSubject: created.class.subject,
      date: created.date.toISOString().slice(0, 10),
      dueDate: created.dueDate.toISOString().slice(0, 10),
      memo: created.memo,
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/assignments]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
