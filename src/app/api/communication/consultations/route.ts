import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function mapConsultation(c: {
  id: string; studentId: string; teacherId: string; date: Date; time: string;
  duration: number; type: string; topic: string; content: string; followUp: string;
  student?: { name: string; parentLinks: { parent: { name: string } }[] } | null;
  teacher?: { name: string } | null;
}) {
  return {
    id: c.id,
    studentId: c.studentId,
    studentName: c.student?.name ?? '',
    parentName: c.student?.parentLinks?.[0]?.parent?.name ?? '',
    teacherId: c.teacherId,
    teacherName: c.teacher?.name ?? '',
    date: c.date.toISOString().slice(0, 10),
    time: c.time,
    duration: c.duration,
    type: c.type,
    topic: c.topic,
    content: c.content,
    followUp: c.followUp,
  };
}

const CONSULT_INCLUDE = {
  student: {
    select: {
      name: true,
      parentLinks: { include: { parent: { select: { name: true } } }, take: 1 },
    },
  },
  teacher: { select: { name: true } },
} as const;

// GET /api/communication/consultations?studentId=
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');

  try {
    const consultations = await prisma.consultationRecord.findMany({
      where: {
        academyId,
        ...(studentId ? { studentId } : {}),
      },
      include: CONSULT_INCLUDE,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(consultations.map(mapConsultation));
  } catch (err) {
    console.error('[GET /api/communication/consultations]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/communication/consultations
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { studentId, teacherId, date, time, duration, type, topic, content, followUp } = await req.json();

    if (!studentId || !teacherId || !date || !topic) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const record = await prisma.consultationRecord.create({
      data: {
        academyId,
        studentId,
        teacherId,
        date: new Date(date),
        time: time ?? '',
        duration: duration ?? 30,
        type: type ?? '대면',
        topic,
        content: content ?? '',
        followUp: followUp ?? '',
      },
      include: CONSULT_INCLUDE,
    });

    return NextResponse.json(mapConsultation(record), { status: 201 });
  } catch (err) {
    console.error('[POST /api/communication/consultations]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
