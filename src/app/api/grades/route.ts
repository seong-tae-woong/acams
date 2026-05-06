import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/grades?examId=xxx — 시험별 성적 목록
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get('examId');

  if (!examId) return NextResponse.json({ error: 'examId is required' }, { status: 400 });

  try {
    const records = await prisma.gradeRecord.findMany({
      where: { academyId, examId },
      include: { student: { select: { name: true } } },
      orderBy: { student: { name: 'asc' } },
    });

    const result = records.map((r) => ({
      id: r.id,
      examId: r.examId,
      studentId: r.studentId,
      studentName: r.student.name,
      score: r.score,
      rank: r.rank,
      memo: r.memo,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/grades]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/grades — 성적 레코드 일괄 upsert (시험 등록 시 빈 레코드 생성)
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: { examId: string; studentId: string; score: number | null; rank: number | null; memo: string }[] =
      await req.json();

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: '성적 데이터가 없습니다.' }, { status: 400 });
    }

    await prisma.$transaction(
      body.map((r) =>
        prisma.gradeRecord.upsert({
          where: { examId_studentId: { examId: r.examId, studentId: r.studentId } },
          create: {
            academyId,
            examId: r.examId,
            studentId: r.studentId,
            score: r.score,
            rank: r.rank ?? null,
            memo: r.memo ?? '',
          },
          update: {
            score: r.score,
            rank: r.rank ?? null,
            memo: r.memo ?? '',
          },
        }),
      ),
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/grades]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
