/**
 * GET /api/ingang/progress
 *
 * 관리자(원장/강사)가 학생별·강의별 시청 진도 + 시험 결과를 조회.
 * - ?lectureId=X         → 해당 강의의 모든 학생 진도 + 최근 attempt
 * - ?studentId=Y         → 해당 학생이 시청한 모든 강의의 진도 + 최근 attempt
 * - ?lectureId=X&studentId=Y → 단일 행
 *
 * 향후 '시청 현황'·'이수율 통계' 페이지가 mockup에서 real로 전환될 때 소비.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  // 원장·강사만 (학생/학부모 호출 차단)
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const lectureId = searchParams.get('lectureId');
  const studentId = searchParams.get('studentId');

  if (!lectureId && !studentId) {
    return NextResponse.json({ error: 'lectureId 또는 studentId 중 하나는 필요합니다.' }, { status: 400 });
  }

  try {
    const rows = await prisma.lectureWatchProgress.findMany({
      where: {
        academyId,
        ...(lectureId ? { lectureId } : {}),
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: { select: { id: true, name: true, attendanceNumber: true } },
        lecture: { select: { id: true, title: true, durationSec: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    // 같은 (studentId, quizId)의 최근 attempt를 함께 묶어 응답
    const quizIds = await prisma.lectureQuiz.findMany({
      where: {
        academyId,
        ...(lectureId ? { lectureId } : {}),
      },
      select: { id: true, lectureId: true, passScore: true, maxTries: true },
    });
    const quizByLecture = new Map(quizIds.map((q) => [q.lectureId, q]));

    const attempts = rows.length > 0 ? await prisma.lectureQuizAttempt.findMany({
      where: {
        academyId,
        studentId: studentId ?? undefined,
        quizId: { in: quizIds.map((q) => q.id) },
      },
      orderBy: { createdAt: 'desc' },
    }) : [];

    const data = rows.map((r) => {
      const q = quizByLecture.get(r.lectureId);
      const studentAttempts = attempts.filter((a) => a.studentId === r.studentId && a.quizId === q?.id);
      const lastAttempt = studentAttempts[0];
      const pct = r.durationSec > 0
        ? Math.min(100, Math.round((r.watchedSeconds / r.durationSec) * 100))
        : 0;
      return {
        studentId: r.studentId,
        studentName: r.student.name,
        attendanceNumber: r.student.attendanceNumber,
        lectureId: r.lectureId,
        lectureTitle: r.lecture.title,
        watchedSeconds: r.watchedSeconds,
        durationSec: r.durationSec,
        pct,
        completedAt: r.completedAt,
        attemptCount: studentAttempts.length,
        maxTries: q?.maxTries ?? null,
        passScore: q?.passScore ?? null,
        lastScore: lastAttempt?.score ?? null,
        lastIsPassed: lastAttempt?.isPassed ?? null,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json({ items: data });
  } catch (err) {
    console.error('[GET /api/ingang/progress]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
