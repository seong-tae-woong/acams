/**
 * POST /api/ingang/completion/notify
 *
 * 미이수 알림 발송 — 학생당 1건 Notification (강의 목록 내장).
 *
 * Body: { items: [{ studentId, lectureIds: string[] }, ...] }
 *
 * 동작:
 * 1. 입력의 (학생, 강의 목록)을 학생별로 집계
 * 2. 7일 throttle: 같은 학생에게 같은 강의로 7일 내 보낸 적 있는지 체크 → 차단된 강의는 제외
 * 3. 남은 강의가 있는 학생별로 1건 Notification + 1건 NotificationRecipient 생성
 * 4. metadata.ingangIncomplete=true + metadata.lectureIds=[...] 저장 (throttle 식별용)
 * 5. sendPushToStudents 호출 (학생당 1번)
 *
 * 응답: { sent: N, skipped: M, skippedReason: [{ studentId, reason }] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { sendPushToStudents } from '@/lib/push/sendPush';

type NotifyItem = { studentId: string; lectureIds: string[] };

const THROTTLE_DAYS = 7;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const rawItems: NotifyItem[] = Array.isArray(body?.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json({ error: '발송 대상이 비어 있습니다.' }, { status: 400 });
    }

    // 학생별로 lectureIds 집계 (중복 제거)
    const byStudent = new Map<string, Set<string>>();
    for (const it of rawItems) {
      if (!it?.studentId || !Array.isArray(it.lectureIds)) continue;
      const set = byStudent.get(it.studentId) ?? new Set<string>();
      for (const lid of it.lectureIds) {
        if (typeof lid === 'string' && lid.length > 0) set.add(lid);
      }
      byStudent.set(it.studentId, set);
    }

    if (byStudent.size === 0) {
      return NextResponse.json({ error: '유효한 항목이 없습니다.' }, { status: 400 });
    }

    // 멀티테넌트 검증: 모든 학생이 이 academy 소속인지 확인
    const studentIds = [...byStudent.keys()];
    const validStudents = await prisma.student.findMany({
      where: { id: { in: studentIds }, academyId },
      select: { id: true, name: true },
    });
    const validStudentMap = new Map(validStudents.map((s) => [s.id, s]));
    if (validStudents.length !== studentIds.length) {
      return NextResponse.json({ error: '학원 외부 학생이 포함돼 있습니다.' }, { status: 403 });
    }

    // 강의 정보 일괄 조회 (제목 + 시청 진도 lookup)
    const allLectureIds = [...new Set([...byStudent.values()].flatMap((s) => [...s]))];
    const [lectures, allProgress] = await Promise.all([
      prisma.lecture.findMany({
        where: { id: { in: allLectureIds }, academyId },
        select: { id: true, title: true },
      }),
      prisma.lectureWatchProgress.findMany({
        where: {
          academyId,
          studentId: { in: studentIds },
          lectureId: { in: allLectureIds },
        },
        select: {
          studentId: true,
          lectureId: true,
          watchedSeconds: true,
          durationSec: true,
        },
      }),
    ]);
    const lectureMap = new Map(lectures.map((l) => [l.id, l]));
    const progressMap = new Map(
      allProgress.map((p) => [`${p.studentId}::${p.lectureId}`, p]),
    );

    // 7일 throttle: 학원의 최근 ingang_incomplete 알림 (학생 + 강의ID metadata 비교)
    const throttleCutoff = new Date(Date.now() - THROTTLE_DAYS * 86400 * 1000);
    const recentNotifications = await prisma.notification.findMany({
      where: {
        academyId,
        sentAt: { gt: throttleCutoff },
        type: 'GENERAL',
        // metadata json path 비교가 어려우므로 일반 조건만 + 후처리
      },
      select: {
        metadata: true,
        recipients: { select: { studentId: true } },
      },
    });

    // (studentId, lectureId) 차단 set
    const blocked = new Set<string>();
    for (const n of recentNotifications) {
      const meta = n.metadata as { ingangIncomplete?: boolean; lectureIds?: string[] } | null;
      if (meta?.ingangIncomplete !== true || !Array.isArray(meta.lectureIds)) continue;
      for (const r of n.recipients) {
        for (const lid of meta.lectureIds) {
          blocked.add(`${r.studentId}::${lid}`);
        }
      }
    }

    // 학생별 발송 처리
    const now = new Date();
    const sent: Array<{ studentId: string; notificationId: string; lectureIds: string[] }> = [];
    const skipped: Array<{ studentId: string; reason: string }> = [];

    for (const [studentId, lecSet] of byStudent.entries()) {
      const student = validStudentMap.get(studentId)!;
      // throttle 통과 강의만 남김
      const finalLectureIds = [...lecSet].filter(
        (lid) => !blocked.has(`${studentId}::${lid}`),
      );

      if (finalLectureIds.length === 0) {
        skipped.push({ studentId, reason: `최근 ${THROTTLE_DAYS}일 내 동일 강의 발송 이력 있음` });
        continue;
      }

      // 본문 생성: 강의 목록 + 진도
      const lectureLines = finalLectureIds.map((lid) => {
        const lec = lectureMap.get(lid);
        const prog = progressMap.get(`${studentId}::${lid}`);
        const pct = prog && prog.durationSec > 0
          ? Math.round((prog.watchedSeconds / prog.durationSec) * 100)
          : 0;
        const pctText = prog ? `${pct}%` : '미시청';
        return `- ${lec?.title ?? '강의'}: ${pctText}`;
      });

      const title = '인강 미이수 안내';
      const content = [
        `${student.name} 학생, 아직 완료하지 않은 인강이 있습니다.`,
        '',
        lectureLines.join('\n'),
        '',
        '학원에서 이수를 마쳐주세요.',
      ].join('\n');

      try {
        const notif = await prisma.notification.create({
          data: {
            academyId,
            type: 'GENERAL',
            title,
            content,
            metadata: { ingangIncomplete: true, lectureIds: finalLectureIds },
            sentById: userId,
            sentAt: now,
            recipients: { create: [{ studentId }] },
          },
          select: { id: true },
        });
        sent.push({ studentId, notificationId: notif.id, lectureIds: finalLectureIds });

        // 푸시 발송 (학생당 1번)
        void sendPushToStudents([studentId], {
          title,
          body: `${student.name} 학생의 미이수 강의 ${finalLectureIds.length}건 안내`,
          url: '/mobile/notifications',
          tag: `ingang-incomplete-${notif.id}`,
        });
      } catch (err) {
        console.error(`[notify] failed for student ${studentId}:`, err instanceof Error ? err.message : String(err));
        skipped.push({ studentId, reason: '내부 오류' });
      }
    }

    return NextResponse.json({
      sentCount: sent.length,
      skippedCount: skipped.length,
      sent,
      skipped,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/ingang/completion/notify]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
