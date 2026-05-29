/**
 * 인강 이수 판정 + 시리즈 완주 stamp helper.
 *
 * 이수 판정 규칙 (eng review 2026-05-29 확정):
 * - examCond='after100': LectureWatchProgress.completedAt != null AND LectureQuizAttempt.isPassed=true
 * - examCond='anytime':  LectureQuizAttempt.isPassed=true (시청률 무관)
 * - 시리즈 이수 = 시리즈 내 모든 강의 이수
 *
 * 시리즈 완주 시점에 LectureSeriesCompletion 1건 자동 stamp.
 * progress route(after100 completedAt set 직후)와 quiz/submit(isPassed=true 직후)에서 호출.
 * 호출자는 try/catch로 helper 실패를 흡수해야 한다 (학생 시청·시험 흐름 보호).
 */

import type { PrismaClient } from '@/generated/prisma/client';

export type ExamCond = 'after100' | 'anytime';

export type LectureCompletionState = {
  /** LectureWatchProgress.completedAt — examCond='after100'에서 시청 임계 도달 시 set */
  watchCompletedAt: Date | null;
  /** 시험 통과 여부 (LectureQuizAttempt 중 1건이라도 isPassed=true) */
  hasPassedAttempt: boolean;
  /** 강의의 examCond (quiz가 없으면 null) */
  examCond: ExamCond | null;
};

/**
 * 강의 단위 이수 판정.
 * - examCond='after100': watchCompletedAt 있음 AND 시험 합격
 * - examCond='anytime':  시험 합격만
 * - quiz 없음(examCond=null): 시험 통과로 판정 불가 → false (defensive)
 */
export function isLectureCompleted(state: LectureCompletionState): boolean {
  if (state.examCond === 'after100') {
    return state.watchCompletedAt != null && state.hasPassedAttempt;
  }
  if (state.examCond === 'anytime') {
    return state.hasPassedAttempt;
  }
  return false;
}

/**
 * 시리즈 단위 이수 판정.
 * - lectureStates: 시리즈 내 모든 강의의 이수 여부 boolean 배열
 * - 빈 시리즈는 이수 아님 (defensive)
 */
export function isSeriesCompleted(lectureStates: boolean[]): boolean {
  if (lectureStates.length === 0) return false;
  return lectureStates.every(Boolean);
}

/**
 * 시리즈 내 시험 점수 평균 계산 (이수증 score snapshot용).
 * - 시험 응시 기록이 없는 강의는 평균에서 제외
 * - 모든 강의가 시험 없으면 null
 */
export function computeSeriesScoreAverage(scores: Array<number | null>): number | null {
  const valid = scores.filter((s): s is number => typeof s === 'number');
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 10) / 10; // 소수점 1자리
}

/**
 * 시리즈 완주 체크 + LectureSeriesCompletion stamp.
 *
 * 호출 시점:
 * - progress route: completedAt set 직후 (examCond='after100' 강의)
 * - quiz/submit:    isPassed=true 직후 (examCond='anytime' 강의 또는 after100의 시험 통과)
 *
 * 동작:
 * 1. 해당 시리즈가 존재하는지 확인 (없으면 no-op)
 * 2. 시리즈 내 모든 강의의 이수 여부 계산
 * 3. 모두 이수면 LectureSeriesCompletion upsert (Unique [studentId, seriesId])
 * 4. 이미 stamp된 경우 no-op
 *
 * 반환값:
 * - stamp 발생 → 생성된 LectureSeriesCompletion
 * - no-op (시리즈 없음 / 미완주 / 이미 stamp) → null
 *
 * 호출자는 try/catch로 throw를 흡수해야 함. throw는 schema 위반/DB 장애 등 예외 상황만.
 */
export async function checkAndStampSeriesCompletion(
  prisma: PrismaClient,
  academyId: string,
  studentId: string,
  seriesId: string,
): Promise<{ id: string; alreadyExisted: boolean } | null> {
  // 1. 시리즈 + 강의 조회 (academyId 격리)
  const series = await prisma.lectureSeries.findFirst({
    where: { id: seriesId, academyId },
    include: {
      lectures: {
        select: {
          id: true,
          quiz: { select: { examCond: true } },
        },
      },
    },
  });

  if (!series || series.lectures.length === 0) return null;

  // 2. 이미 stamp된 경우 fast path
  const existing = await prisma.lectureSeriesCompletion.findUnique({
    where: { studentId_seriesId: { studentId, seriesId } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, alreadyExisted: true };

  // 3. 시리즈 내 모든 강의 progress + attempts 일괄 조회
  const lectureIds = series.lectures.map((l) => l.id);
  const [progresses, attempts] = await Promise.all([
    prisma.lectureWatchProgress.findMany({
      where: { studentId, lectureId: { in: lectureIds } },
      select: { lectureId: true, completedAt: true },
    }),
    prisma.lectureQuizAttempt.findMany({
      where: {
        studentId,
        quiz: { lectureId: { in: lectureIds } },
      },
      select: { score: true, isPassed: true, quiz: { select: { lectureId: true } } },
    }),
  ]);

  const progressMap = new Map(progresses.map((p) => [p.lectureId, p]));
  const attemptsByLecture = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = attemptsByLecture.get(a.quiz.lectureId) ?? [];
    list.push(a);
    attemptsByLecture.set(a.quiz.lectureId, list);
  }

  // 4. 강의별 이수 판정
  const lectureCompletions: boolean[] = [];
  const scoresForSnapshot: Array<number | null> = [];
  for (const lec of series.lectures) {
    const lecAttempts = attemptsByLecture.get(lec.id) ?? [];
    const hasPassedAttempt = lecAttempts.some((a) => a.isPassed);
    const watchCompletedAt = progressMap.get(lec.id)?.completedAt ?? null;
    const examCond = (lec.quiz?.examCond as ExamCond | undefined) ?? null;
    lectureCompletions.push(isLectureCompleted({ watchCompletedAt, hasPassedAttempt, examCond }));

    // 점수 snapshot: 최고 점수 사용 (재응시 허용 케이스 고려)
    const bestScore = lecAttempts.length > 0
      ? Math.max(...lecAttempts.map((a) => a.score))
      : null;
    scoresForSnapshot.push(bestScore);
  }

  if (!isSeriesCompleted(lectureCompletions)) return null;

  // 5. LectureSeriesCompletion 생성 (Unique 제약으로 race 보호)
  const scoreSnapshot = computeSeriesScoreAverage(scoresForSnapshot);
  try {
    const created = await prisma.lectureSeriesCompletion.create({
      data: {
        academyId,
        studentId,
        seriesId,
        scoreSnapshot,
      },
      select: { id: true },
    });
    return { id: created.id, alreadyExisted: false };
  } catch (err) {
    // Unique 제약 위반 = race 시 다른 호출이 먼저 stamp함. fetch 후 반환.
    const winner = await prisma.lectureSeriesCompletion.findUnique({
      where: { studentId_seriesId: { studentId, seriesId } },
      select: { id: true },
    });
    if (winner) return { id: winner.id, alreadyExisted: true };
    throw err;
  }
}
