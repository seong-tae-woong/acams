import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { resolveStudentId, resolveClassIds } from '@/lib/mobile/resolveStudent';
import { requireAuth } from '@/lib/auth/requireAuth';

// GET /api/mobile/grades?studentId=
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

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

    // 학생의 활성 수강 반 → 다가오는 시험·과제 (오늘 포함)
    const classIds = await resolveClassIds(studentId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingExams = classIds.length === 0 ? [] : await prisma.exam.findMany({
      where: { academyId, classId: { in: classIds }, date: { gte: today } },
      include: { class: { select: { name: true, subject: true } } },
      orderBy: { date: 'asc' },
    });

    const upcomingAssignments = classIds.length === 0 ? [] : await prisma.assignment.findMany({
      where: { academyId, classId: { in: classIds }, dueDate: { gte: today } },
      include: { class: { select: { name: true, subject: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json({
      studentName: student?.name ?? '',
      grades,
      upcomingExams: upcomingExams.map((e) => ({
        id: e.id,
        name: e.name,
        subject: e.subject,
        date: e.date.toISOString().slice(0, 10),
        totalScore: e.totalScore,
        description: e.description,
        className: e.class.name,
        classSubject: e.class.subject,
      })),
      upcomingAssignments: upcomingAssignments.map((a) => ({
        id: a.id,
        date: a.date.toISOString().slice(0, 10),
        dueDate: a.dueDate.toISOString().slice(0, 10),
        memo: a.memo,
        className: a.class.name,
        classSubject: a.class.subject,
      })),
    });
  } catch (err) {
    console.error('[GET /api/mobile/grades]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
