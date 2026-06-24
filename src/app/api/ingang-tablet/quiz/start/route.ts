/**
 * POST /api/ingang-tablet/quiz/start
 *
 * 시험 응시 시작. 게이트 체크 후 통과하면 문제(정답 제외)를 내려준다.
 *
 * body: { sessionId, lectureId }
 *
 * 게이트 순서:
 *  1) examCond === 'after100' 이면 LectureWatchProgress.completedAt 필수
 *  2) attempts.count < maxTries OR 미사용 LectureRetryPermission 보유
 */
import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

function log(event: string, fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(`[INGANG.quiz.start] ${event}`, JSON.stringify(fields));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'tablet') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, lectureId } = await req.json();
    if (!sessionId || !lectureId) {
      return NextResponse.json({ error: 'sessionId, lectureId 필요' }, { status: 400 });
    }

    const session = await prisma.ingangViewSession.findFirst({
      where: { id: sessionId, academyId, status: 'APPROVED' },
      select: { studentId: true },
    });
    if (!session) return NextResponse.json({ error: '세션이 만료되었거나 승인되지 않았습니다.' }, { status: 401 });
    const studentId = session.studentId;

    const quiz = await prisma.lectureQuiz.findFirst({
      where: { lectureId, academyId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: { options: { orderBy: { orderIndex: 'asc' }, select: { id: true, text: true } } },
        },
      },
    });
    if (!quiz) return NextResponse.json({ error: '이 강의에는 출제된 시험이 없습니다.', code: 'NO_QUIZ' }, { status: 404 });
    if (quiz.questions.length === 0) {
      return NextResponse.json({ error: '이 강의에는 출제된 시험이 없습니다.', code: 'NO_QUESTIONS' }, { status: 404 });
    }

    // 게이트 1: 시청률
    if (quiz.examCond === 'after100') {
      const progress = await prisma.lectureWatchProgress.findUnique({
        where: { studentId_lectureId: { studentId, lectureId } },
        select: { completedAt: true, watchedSeconds: true, durationSec: true },
      });
      if (!progress?.completedAt) {
        const pct = progress && progress.durationSec > 0
          ? Math.round((progress.watchedSeconds / progress.durationSec) * 100)
          : 0;
        log('blocked_watch', { studentId, lectureId, pct, required: quiz.passWatchPct });
        return NextResponse.json({
          blocked: true,
          reason: 'WATCH_INSUFFICIENT',
          detail: { pct, required: quiz.passWatchPct },
        });
      }
    }

    // 게이트 2: 응시 횟수
    const attemptCount = await prisma.lectureQuizAttempt.count({
      where: { quizId: quiz.id, studentId },
    });
    if (attemptCount >= quiz.maxTries) {
      const retryPerm = await prisma.lectureRetryPermission.findFirst({
        where: { quizId: quiz.id, studentId, usedAt: null },
        select: { id: true },
      });
      if (!retryPerm) {
        log('blocked_tries', { studentId, lectureId, attemptCount, maxTries: quiz.maxTries });
        return NextResponse.json({
          blocked: true,
          reason: 'TRIES_EXHAUSTED',
          detail: { attemptCount, maxTries: quiz.maxTries },
        });
      }
    }

    // 통과 — 정답 정보 제외하고 문제 반환
    const questions = quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      score: q.score,
      options: q.options, // {id, text}만
    }));

    log('start_ok', { studentId, lectureId, quizId: quiz.id, attemptCount, maxTries: quiz.maxTries });
    return NextResponse.json({
      quizId: quiz.id,
      passScore: quiz.passScore,
      maxTries: quiz.maxTries,
      attemptCount,
      questions,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/ingang-tablet/quiz/start]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
