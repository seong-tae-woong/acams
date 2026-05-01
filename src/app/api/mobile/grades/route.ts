import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId } from '@/lib/mobile/resolveStudent';

// GET /api/mobile/grades?studentId=
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const requestedStudentId = new URL(req.url).searchParams.get('studentId');

  try {
    const studentId = await resolveStudentId({ userId, role, academyId, requestedStudentId });
    if (!studentId) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { name: true },
    });

    const gradeRecords = await prisma.gradeRecord.findMany({
      where: { academyId, studentId },
      include: {
        exam: {
          include: {
            class: { select: { id: true, name: true, subject: true } },
          },
        },
      },
      orderBy: { exam: { date: 'desc' } },
    });

    const grades = gradeRecords.map((g) => ({
      id: g.id,
      examId: g.examId,
      score: g.score,
      rank: g.rank,
      memo: g.memo,
      exam: {
        id: g.exam.id,
        name: g.exam.name,
        subject: g.exam.subject,
        date: g.exam.date.toISOString().slice(0, 10),
        totalScore: g.exam.totalScore,
        className: g.exam.class.name,
        classSubject: g.exam.class.subject,
      },
    }));

    return NextResponse.json({ studentName: student?.name ?? '', grades });
  } catch (err) {
    console.error('[GET /api/mobile/grades]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
