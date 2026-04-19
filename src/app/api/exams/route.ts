import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/exams?classId=xxx — 반별 시험 목록
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');

  try {
    const exams = await prisma.exam.findMany({
      where: {
        academyId,
        ...(classId ? { classId } : {}),
      },
      include: {
        class: { select: { name: true, subject: true } },
      },
      orderBy: { date: 'desc' },
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
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/exams]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/exams — 시험 등록
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, subject, classId, className, date, totalScore, description } = await req.json();

    if (!name || !classId || !date) {
      return NextResponse.json({ error: '시험명, 반, 날짜는 필수입니다.' }, { status: 400 });
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
      },
      include: {
        class: { select: { name: true } },
      },
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
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/exams]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
