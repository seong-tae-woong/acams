import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/mobile/grades
// role=student → 본인 성적, role=parent → 자녀 성적
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!academyId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let studentId: string | null = null;
    let studentName = '';

    if (role === 'student') {
      // 학생 본인
      const student = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true, name: true },
      });
      if (!student) return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
      studentId = student.id;
      studentName = student.name;
    } else if (role === 'parent') {
      // 학부모 → 첫 번째 자녀
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: { student: { select: { id: true, name: true } } },
            take: 1,
          },
        },
      });
      if (!parent || parent.children.length === 0) {
        return NextResponse.json({ error: '자녀 정보를 찾을 수 없습니다.' }, { status: 404 });
      }
      studentId = parent.children[0].student.id;
      studentName = parent.children[0].student.name;
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 성적 + 시험 정보 조회
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

    return NextResponse.json({ studentName, grades });
  } catch (err) {
    console.error('[GET /api/mobile/grades]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
