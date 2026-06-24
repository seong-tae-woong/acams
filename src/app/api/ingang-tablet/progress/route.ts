/**
 * POST /api/ingang-tablet/progress
 *
 * 인강 시청 진도 보고. 학원로그 비치 태블릿(role=tablet)에서 5초 throttle로 호출.
 * 서버가 권위 있게 (positionDelta, timeDelta)를 계산해 누적 — 클라이언트의 watchedDelta는 신뢰하지 않음.
 *
 * body: {
 *   sessionId: string,           // ingangViewSession (APPROVED 상태)
 *   lectureId: string,
 *   currentPositionSec: number,  // SDK의 currentTime
 *   cfVideoId: string,           // 영상 교체 감지용
 *   batch?: Array<{ positionSec: number; ts: number }>  // 네트워크 일시 실패 시 누적된 보고
 * }
 *
 * 갭 룰: posDelta ∈ [0,6] AND timeDelta ∈ [0,6] 일 때만 add. 그 외에는 lastPosition만 갱신.
 * 임계 도달 시 completedAt set (WHERE NULL 조건부 update로 race 차단).
 */
import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

const MAX_DELTA_SEC = 6; // 5초 throttle + 1초 여유

type ProgressItem = { positionSec: number; ts: number };

function log(event: string, fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(`[INGANG.progress] ${event}`, JSON.stringify(fields));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  if (role !== 'tablet') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sessionId, lectureId, currentPositionSec, cfVideoId, batch } = body as {
      sessionId?: string;
      lectureId?: string;
      currentPositionSec?: number;
      cfVideoId?: string;
      batch?: ProgressItem[];
    };

    if (!sessionId || !lectureId || typeof currentPositionSec !== 'number' || !cfVideoId) {
      return NextResponse.json({ error: 'sessionId, lectureId, currentPositionSec, cfVideoId 필요' }, { status: 400 });
    }

    // 세션 + 학생 식별
    const session = await prisma.ingangViewSession.findFirst({
      where: { id: sessionId, academyId, status: 'APPROVED' },
      select: { studentId: true },
    });
    if (!session) {
      log('session_invalid', { sessionId, academyId });
      return NextResponse.json({ error: '세션이 만료되었거나 승인되지 않았습니다.' }, { status: 401 });
    }
    const studentId = session.studentId;

    // 강의 + durationSec
    const lecture = await prisma.lecture.findFirst({
      where: { id: lectureId, academyId },
      select: { cfVideoId: true, durationSec: true, seriesId: true, quiz: { select: { passWatchPct: true, examCond: true } } },
    });
    if (!lecture) {
      return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (!lecture.cfVideoId || lecture.cfVideoId !== cfVideoId) {
      log('cfvideo_mismatch', { lectureId, expected: lecture.cfVideoId, got: cfVideoId });
      return NextResponse.json({ error: '강의 영상이 변경되었습니다. 새로고침해주세요.', code: 'CF_VIDEO_MISMATCH' }, { status: 409 });
    }
    const durationSec = lecture.durationSec;
    if (!durationSec || durationSec <= 0) {
      // 영상 길이 미확정(인코딩 중 or backfill 미실행) — lastPosition만 추적, 누적·임계 판정 보류
      log('duration_missing', { lectureId, currentPositionSec });
      await prisma.lectureWatchProgress.upsert({
        where: { studentId_lectureId: { studentId, lectureId } },
        update: { lastPositionSec: Math.max(0, Math.floor(currentPositionSec)) },
        create: {
          academyId, lectureId, studentId,
          watchedSeconds: 0,
          lastPositionSec: Math.max(0, Math.floor(currentPositionSec)),
          durationSec: 0,
          cfVideoId,
        },
      });
      return NextResponse.json({ watchedSeconds: 0, pct: 0, completed: false, durationUnknown: true });
    }

    // 입력 sanity
    if (currentPositionSec < 0 || currentPositionSec > durationSec + 5) {
      return NextResponse.json({ error: '잘못된 재생 위치입니다.', code: 'INVALID_POSITION' }, { status: 400 });
    }

    // batch 처리: 시간순 정렬. 마지막 item의 positionSec를 currentPositionSec로 간주.
    const items: ProgressItem[] = Array.isArray(batch) && batch.length > 0
      ? [...batch].sort((a, b) => a.ts - b.ts)
      : [{ positionSec: currentPositionSec, ts: Date.now() }];

    const prior = await prisma.lectureWatchProgress.findUnique({
      where: { studentId_lectureId: { studentId, lectureId } },
    });

    let prevPos = prior?.lastPositionSec ?? 0;
    let prevTs = prior ? prior.updatedAt.getTime() : Date.now() - 1000;
    let watchedDelta = 0;

    for (const it of items) {
      const posDelta = it.positionSec - prevPos;
      const timeDelta = (it.ts - prevTs) / 1000;
      if (posDelta >= 0 && posDelta <= MAX_DELTA_SEC && timeDelta >= 0 && timeDelta <= MAX_DELTA_SEC) {
        watchedDelta += Math.min(posDelta, MAX_DELTA_SEC);
      } else {
        log('gap_skip', { studentId, lectureId, posDelta, timeDelta });
      }
      prevPos = it.positionSec;
      prevTs = it.ts;
    }

    const newLastPos = Math.max(0, Math.min(durationSec, Math.floor(prevPos)));
    const wsCapped = (n: number) => Math.max(0, Math.min(durationSec, n));

    if (!prior) {
      // 첫 보고
      const created = await prisma.lectureWatchProgress.create({
        data: {
          academyId, lectureId, studentId,
          watchedSeconds: wsCapped(Math.floor(watchedDelta)),
          lastPositionSec: newLastPos,
          durationSec,
          cfVideoId,
        },
      });
      const pct = Math.round((created.watchedSeconds / durationSec) * 100);
      const threshold = lecture.quiz?.passWatchPct ?? 100;
      const reachedThreshold = lecture.quiz?.examCond === 'after100' && pct >= threshold;
      let completedAt: Date | null = null;
      if (reachedThreshold) {
        const set = await prisma.lectureWatchProgress.updateMany({
          where: { id: created.id, completedAt: null },
          data: { completedAt: new Date() },
        });
        if (set.count > 0) {
          completedAt = new Date();
          // 시리즈 완주 stamp trigger (try/catch로 응답 흐름 보호)
          if (lecture.seriesId) {
            try {
              const { checkAndStampSeriesCompletion } = await import('@/lib/ingang/completion');
              await checkAndStampSeriesCompletion(prisma, academyId, studentId, lecture.seriesId);
            } catch (err) {
              console.error('[progress] series completion stamp failed:', err instanceof Error ? err.message : String(err));
            }
          }
        }
      }
      log('created', { studentId, lectureId, pct, completedAt: !!completedAt });
      return NextResponse.json({ watchedSeconds: created.watchedSeconds, pct, completed: !!completedAt });
    }

    // 영상 교체 감지 (이론상 mismatch 위에서 잡혀야 하나 prior에 다른 cfVideoId가 stamp되어 있을 수 있음)
    if (prior.cfVideoId !== cfVideoId) {
      log('reset_cf_change', { studentId, lectureId, priorCf: prior.cfVideoId, newCf: cfVideoId });
      const reset = await prisma.lectureWatchProgress.update({
        where: { id: prior.id },
        data: {
          watchedSeconds: 0,
          lastPositionSec: newLastPos,
          durationSec,
          cfVideoId,
          completedAt: null,
        },
      });
      return NextResponse.json({ watchedSeconds: reset.watchedSeconds, pct: 0, completed: false });
    }

    const nextWs = wsCapped(prior.watchedSeconds + Math.floor(watchedDelta));
    const updated = await prisma.lectureWatchProgress.update({
      where: { id: prior.id },
      data: {
        watchedSeconds: nextWs,
        lastPositionSec: newLastPos,
        // durationSec가 변경되었다면 stamp 갱신 (예: 백필 직후)
        ...(prior.durationSec !== durationSec ? { durationSec } : {}),
      },
    });

    const pct = Math.round((updated.watchedSeconds / durationSec) * 100);
    const threshold = lecture.quiz?.passWatchPct ?? 100;
    const examCondAfter = lecture.quiz?.examCond === 'after100';

    let completed = !!prior.completedAt;
    let justCompletedNow = false;
    if (!completed && examCondAfter && pct >= threshold) {
      const set = await prisma.lectureWatchProgress.updateMany({
        where: { id: prior.id, completedAt: null },
        data: { completedAt: new Date() },
      });
      if (set.count > 0) {
        completed = true;
        justCompletedNow = true;
        log('completed', { studentId, lectureId, pct, threshold });
      }
    }

    // 시리즈 완주 stamp trigger (방금 강의 이수 시점에만 + try/catch로 응답 보호)
    if (justCompletedNow && lecture.seriesId) {
      try {
        const { checkAndStampSeriesCompletion } = await import('@/lib/ingang/completion');
        await checkAndStampSeriesCompletion(prisma, academyId, studentId, lecture.seriesId);
      } catch (err) {
        console.error('[progress] series completion stamp failed:', err instanceof Error ? err.message : String(err));
      }
    }

    return NextResponse.json({ watchedSeconds: updated.watchedSeconds, pct, completed });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/ingang-tablet/progress]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
