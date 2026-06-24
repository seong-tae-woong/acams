/**
 * GET /api/ingang/completion/at-risk?cursor=&limit=&filter=
 *
 * 위험 학생 패널 — (학생, 강의) pair 단위 행.
 * - filter: 'all' | 'not_started' | 'in_progress' | 'exam_pending' | 'failed'
 * - cursor: lastSeenId (lecture_watch_progress.id 기반 cursor pagination)
 *
 * "위험 학생" 정의: 강의에 대해 아직 이수하지 못한 학생.
 * - LectureTarget(반) + LectureStudentTarget(개별)로 강의에 배정된 학생 중
 * - 해당 강의가 이수되지 않은 (학생, 강의) pair 목록
 *
 * 1차 스프린트는 단순화: LectureWatchProgress 기반(이미 1회 이상 시청 시도한 학생)으로 시작.
 * 미시청자(progress row 자체가 없는 학생)는 별도 표시.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { isLectureCompleted, type ExamCond } from '@/lib/ingang/completion';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const limit = Math.min(
    Number(searchParams.get('limit')) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const filter = searchParams.get('filter') ?? 'all'; // 'all' | 'not_started' | 'in_progress' | 'exam_pending' | 'failed'

  try {
    // 모든 progress row 조회 (단순화). 학원이 크면 cursor로 페이지네이션.
    const rows = await prisma.lectureWatchProgress.findMany({
      where: { academyId },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1, // 다음 cursor 결정용 +1
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        studentId: true,
        lectureId: true,
        watchedSeconds: true,
        durationSec: true,
        completedAt: true,
        updatedAt: true,
        student: { select: { id: true, name: true } },
        lecture: {
          select: {
            id: true,
            title: true,
            seriesId: true,
            series: { select: { title: true } },
            quiz: { select: { examCond: true, passScore: true } },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // 각 (학생, 강의) pair에 대한 합격 attempt 일괄 조회
    const studentIds = [...new Set(items.map((r) => r.studentId))];
    const lectureIds = [...new Set(items.map((r) => r.lectureId))];
    const attempts = studentIds.length > 0 && lectureIds.length > 0
      ? await prisma.lectureQuizAttempt.findMany({
          where: {
            academyId,
            studentId: { in: studentIds },
            quiz: { lectureId: { in: lectureIds } },
          },
          select: {
            studentId: true,
            score: true,
            isPassed: true,
            quiz: { select: { lectureId: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const attemptMap = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const key = `${a.studentId}::${a.quiz.lectureId}`;
      const list = attemptMap.get(key) ?? [];
      list.push(a);
      attemptMap.set(key, list);
    }

    // 응답 행 생성 + 상태 분류
    const result = items
      .map((r) => {
        const key = `${r.studentId}::${r.lectureId}`;
        const lecAttempts = attemptMap.get(key) ?? [];
        const hasPassedAttempt = lecAttempts.some((a) => a.isPassed);
        const lastAttempt = lecAttempts[0]; // orderBy createdAt desc 기준 첫 번째
        const examCond = (r.lecture?.quiz?.examCond as ExamCond | undefined) ?? null;
        const completed = isLectureCompleted({
          watchCompletedAt: r.completedAt,
          hasPassedAttempt,
          examCond,
        });
        const pct = r.durationSec > 0
          ? Math.round((r.watchedSeconds / r.durationSec) * 100)
          : 0;

        let status: 'not_started' | 'in_progress' | 'exam_pending' | 'failed' | 'completed';
        if (completed) status = 'completed';
        else if (pct === 0) status = 'not_started';
        else if (r.completedAt && lecAttempts.length === 0) status = 'exam_pending';
        else if (r.completedAt && !hasPassedAttempt && lecAttempts.length > 0) status = 'failed';
        else status = 'in_progress';

        return {
          id: r.id,
          studentId: r.studentId,
          studentName: r.student.name,
          lectureId: r.lectureId,
          lectureTitle: r.lecture?.title ?? '',
          seriesTitle: r.lecture?.series?.title ?? null,
          progressPct: pct,
          completedAt: r.completedAt,
          lastAttemptScore: lastAttempt?.score ?? null,
          lastAttemptPassed: lastAttempt?.isPassed ?? null,
          updatedAt: r.updatedAt,
          status,
        };
      })
      .filter((r) => {
        if (r.status === 'completed') return false; // 위험 패널에서 이수 완료자 제외
        if (filter === 'all') return true;
        return r.status === filter;
      });

    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return NextResponse.json({ items: result, nextCursor });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/ingang/completion/at-risk]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
