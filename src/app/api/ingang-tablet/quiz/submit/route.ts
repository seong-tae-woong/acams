/**
 * POST /api/ingang-tablet/quiz/submit
 *
 * 시험 제출 + 채점. LectureQuizAttempt 행 생성.
 * 미사용 LectureRetryPermission이 있다면 usedAt = now.
 * 1초 dedup: 같은 (sessionId, lectureId)로 직전 1초 이내 제출은 거부.
 *
 * body: {
 *   sessionId, lectureId,
 *   answers: Record<questionId, optionId>
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

function log(event: string, fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(`[INGANG.quiz.submit] ${event}`, JSON.stringify(fields));
}

// 1초 dedup용 인메모리 캐시 (단일 인스턴스 기준).
// 분산 환경이라면 Redis 등이 필요하지만 본 학원로그 트래픽 기준 단일 인스턴스로 충분.
const recentSubmits = new Map<string, number>();
function dedupKey(sessionId: string, lectureId: string) { return `${sessionId}::${lectureId}`; }

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'tablet') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { sessionId, lectureId, answers } = body as {
      sessionId?: string; lectureId?: string; answers?: Record<string, string>;
    };
    if (!sessionId || !lectureId || !answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'sessionId, lectureId, answers 필요' }, { status: 400 });
    }

    // 1초 dedup
    const key = dedupKey(sessionId, lectureId);
    const now = Date.now();
    const last = recentSubmits.get(key);
    if (last && now - last < 1000) {
      log('dedup_block', { sessionId, lectureId, elapsed: now - last });
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
    }
    recentSubmits.set(key, now);
    // 메모리 누수 방지 — 60초 지난 항목 정리
    if (recentSubmits.size > 500) {
      const cutoff = now - 60_000;
      for (const [k, t] of recentSubmits) {
        if (t < cutoff) recentSubmits.delete(k);
      }
    }

    const session = await prisma.ingangViewSession.findFirst({
      where: { id: sessionId, academyId, status: 'APPROVED' },
      select: { studentId: true },
    });
    if (!session) return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 });
    const studentId = session.studentId;

    const quiz = await prisma.lectureQuiz.findFirst({
      where: { lectureId, academyId },
      include: {
        questions: {
          include: { options: { select: { id: true, isCorrect: true } } },
        },
      },
    });
    if (!quiz || quiz.questions.length === 0) {
      return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 재응시 횟수 게이트 (start와 동일 — submit 직전에도 확인)
    const attemptCount = await prisma.lectureQuizAttempt.count({
      where: { quizId: quiz.id, studentId },
    });
    let usedRetryPerm: { id: string } | null = null;
    if (attemptCount >= quiz.maxTries) {
      usedRetryPerm = await prisma.lectureRetryPermission.findFirst({
        where: { quizId: quiz.id, studentId, usedAt: null },
        select: { id: true },
      });
      if (!usedRetryPerm) {
        return NextResponse.json({ error: '응시 횟수를 초과했습니다.', code: 'TRIES_EXHAUSTED' }, { status: 403 });
      }
    }

    // 채점: question.score × isCorrect(선택한 옵션)
    let earned = 0;
    let totalScore = 0;
    for (const q of quiz.questions) {
      totalScore += q.score;
      const picked = answers[q.id];
      if (!picked) continue;
      const opt = q.options.find((o) => o.id === picked);
      if (opt?.isCorrect) earned += q.score;
    }
    const scorePct = totalScore > 0 ? Math.round((earned / totalScore) * 100) : 0;
    const isPassed = scorePct >= quiz.passScore;

    // attempt 생성 + retryPerm 사용 처리를 트랜잭션으로
    const attempt = await prisma.$transaction(async (tx) => {
      const created = await tx.lectureQuizAttempt.create({
        data: {
          academyId,
          quizId: quiz.id,
          studentId,
          score: scorePct,
          isPassed,
        },
      });
      if (usedRetryPerm) {
        await tx.lectureRetryPermission.updateMany({
          where: { id: usedRetryPerm.id, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      return created;
    });

    const triesRemaining = Math.max(0, quiz.maxTries - (attemptCount + 1));
    log('attempt', { studentId, lectureId, quizId: quiz.id, score: scorePct, isPassed, attemptNo: attemptCount + 1, triesRemaining, usedRetryPerm: !!usedRetryPerm });

    return NextResponse.json({
      attemptId: attempt.id,
      score: scorePct,
      isPassed,
      passScore: quiz.passScore,
      triesRemaining,
      usedRetryPerm: !!usedRetryPerm,
    });
  } catch (err) {
    console.error('[POST /api/ingang-tablet/quiz/submit]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
