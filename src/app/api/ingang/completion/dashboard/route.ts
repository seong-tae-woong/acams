/**
 * GET /api/ingang/completion/dashboard
 *
 * 이수관리 홈 KPI 4종 일괄 반환:
 * - totalEnrolled:   전체 인강 대상 학생 수
 * - notStarted:      미시청자 수 (시청 진도 0%)
 * - examPending:     시험 대기자 수 (시청은 됐는데 합격 attempt 없음, after100만)
 * - eligibleCount:   이수증 발급 가능자 수 (LectureSeriesCompletion 있고 Certificate 미발급)
 * - completionRate:  전체 시리즈 이수율 (LSC 수 / (수강생 × 시리즈 수))
 *
 * 위험 학생 + 발급 대기자 리스트는 별도 cursor pagination API.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [
      totalEnrolledStudents,
      progressRows,
      seriesCount,
      lscCount,
      eligibleCount,
    ] = await Promise.all([
      // 인강 수강 대상 학생 수: LectureTarget(반) + LectureStudentTarget(개별)로 연결된 학생 distinct
      // 단순 근사: ACTIVE 상태 학생 전체 수 (이 학원에서 인강을 안 보는 학생도 분모에 포함)
      prisma.student.count({
        where: { academyId, status: 'ACTIVE' },
      }),
      // 전체 시청 진도 (시리즈 미소속 강의 포함)
      prisma.lectureWatchProgress.findMany({
        where: { academyId },
        select: {
          studentId: true,
          lectureId: true,
          watchedSeconds: true,
          durationSec: true,
          completedAt: true,
          lecture: {
            select: {
              seriesId: true,
              quiz: { select: { examCond: true } },
            },
          },
        },
      }),
      // 학원의 시리즈 수 (PUBLISHED만)
      prisma.lectureSeries.count({
        where: { academyId, status: 'PUBLISHED' },
      }),
      // 이미 완주된 시리즈 수
      prisma.lectureSeriesCompletion.count({
        where: { academyId },
      }),
      // 발급 가능자: LSC 있고 Certificate 없음
      prisma.lectureSeriesCompletion.count({
        where: {
          academyId,
          certificate: null,
        },
      }),
    ]);

    // 미시청자 수: 학생 중 인강 강의 watch 기록이 하나도 없는 학생
    const studentsWithProgress = new Set(progressRows.map((p) => p.studentId));
    const notStarted = Math.max(0, totalEnrolledStudents - studentsWithProgress.size);

    // 시험 대기자: after100 강의의 watch completedAt이 있고 아직 합격 attempt 없는 (학생, 강의) pair 수
    // 정확 계산은 학생별 attempt 조회 필요 → 첫 ship에서는 근사: completedAt 있는 행 수에서 합격 학생 차감
    // 더 단순: completedAt 있고 examCond=after100인 watchProgress 학생-강의 pair에서 합격 attempt 없는 수
    const completedWatchPairs = progressRows
      .filter((p) => p.completedAt != null && p.lecture?.quiz?.examCond === 'after100')
      .map((p) => ({ studentId: p.studentId, lectureId: p.lectureId }));

    let examPending = 0;
    if (completedWatchPairs.length > 0) {
      const completedLectureIds = [...new Set(completedWatchPairs.map((p) => p.lectureId))];
      const completedStudentIds = [...new Set(completedWatchPairs.map((p) => p.studentId))];
      const passedAttempts = await prisma.lectureQuizAttempt.findMany({
        where: {
          academyId,
          isPassed: true,
          studentId: { in: completedStudentIds },
          quiz: { lectureId: { in: completedLectureIds } },
        },
        select: { studentId: true, quiz: { select: { lectureId: true } } },
      });
      const passedSet = new Set(passedAttempts.map((a) => `${a.studentId}::${a.quiz.lectureId}`));
      examPending = completedWatchPairs.filter(
        (p) => !passedSet.has(`${p.studentId}::${p.lectureId}`),
      ).length;
    }

    // 전체 이수율: LSC 수 / (수강생 × 시리즈 수). 분모가 0이면 0%.
    const denominator = totalEnrolledStudents * seriesCount;
    const completionRate = denominator > 0
      ? Math.round((lscCount / denominator) * 1000) / 10
      : 0;

    return NextResponse.json({
      totalEnrolled: totalEnrolledStudents,
      notStarted,
      examPending,
      eligibleCount,
      completionRate,
      seriesCount,
      seriesCompletionCount: lscCount,
    });
  } catch (err) {
    console.error('[GET /api/ingang/completion/dashboard]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
