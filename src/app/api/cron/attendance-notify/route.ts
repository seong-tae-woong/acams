// Cron 엔드포인트: 매 5분 호출되어 결석/지각 자동 알림 발송.
//
// 호출자: GitHub Actions 스케줄(.github/workflows/attendance-notify.yml).
//   Hobby 플랜은 Vercel Cron 5분 간격을 허용하지 않아 외부 스케줄로 호출한다.
//   `Authorization: Bearer <CRON_SECRET>` 헤더로 인증.
// 인증 우회 방지 — proxy.ts의 PUBLIC_PATHS에 /api/cron 추가되어 있음 (JWT 미적용).
//
// 흐름:
//   1. KST 기준 현재 요일/시각 계산
//   2. 자동 알림 활성화된 학원의 오늘 요일 ClassSchedule 모두 조회
//   3. 임계값 윈도우(LATE 또는 ABSENT)에 진입한 수업만 필터
//   4. 해당 수업의 활성 수강생 중 PRESENT 기록 없는 학생 = 알림 대상
//   5. AttendanceNotificationLog INSERT (UNIQUE 충돌 = 이미 보냄, skip)
//   6. NotificationTemplate(code) 가져와 변수 치환 후 Notification 생성 + 학부모에게 Web Push

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { AttendanceStatus } from '@/generated/prisma/client';
import { sendPushToUserIds } from '@/lib/push/sendPush';
import { renderTemplate } from '@/lib/notification/renderTemplate';
import {
  classifyWindow,
  parseHHMM,
  toKstParts,
  type WindowKind,
} from '@/lib/notification/attendanceNotify';

// 임계값 도달 후 발송을 허용하는 윈도우 폭(분). cron 주기(5분)보다 넉넉히 두어
// GitHub Actions 스케줄의 지연/누락에도 알림이 빠지지 않게 한다.
// (중복은 AttendanceNotificationLog UNIQUE로 차단)
const WINDOW_GRACE_MIN = 20;

type CronStats = {
  schedulesScanned: number;
  windowsHit: number;
  studentsTargeted: number;
  alertsSent: number;
  alertsSkipped: number;
};

export async function GET(req: NextRequest) {
  // Vercel Cron 인증
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats: CronStats = {
    schedulesScanned: 0,
    windowsHit: 0,
    studentsTargeted: 0,
    alertsSent: 0,
    alertsSkipped: 0,
  };

  try {
    const { dayOfWeek, totalMinutes: nowMin, midnightUtc } = toKstParts(new Date());

    // 자동 알림 활성화된 학원 × 오늘 요일 수업의 ClassSchedule
    const schedules = await prisma.classSchedule.findMany({
      where: {
        dayOfWeek,
        class: {
          isActive: true,
          academy: { attendanceNotifyEnabled: true, isActive: true },
        },
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            academyId: true,
            academy: {
              select: {
                attendanceLateMinutes: true,
                attendanceAbsentMinutes: true,
              },
            },
            enrollments: {
              where: { isActive: true },
              select: { studentId: true },
            },
          },
        },
      },
    });

    stats.schedulesScanned = schedules.length;

    for (const sched of schedules) {
      const startMin = parseHHMM(sched.startTime);
      if (startMin === null) continue;

      const { attendanceLateMinutes: lateMin, attendanceAbsentMinutes: absentMin } = sched.class.academy;
      const kind: WindowKind = classifyWindow(nowMin, startMin, lateMin, absentMin, WINDOW_GRACE_MIN);
      if (kind === 'NONE') continue;
      stats.windowsHit += 1;

      const classId = sched.classId;
      const academyId = sched.class.academyId;
      const enrolledIds = sched.class.enrollments.map((e) => e.studentId);
      if (enrolledIds.length === 0) continue;

      // 등원이 확인된 학생(출석/지각/조퇴)은 자동 알림 대상에서 제외한다.
      // 지각/조퇴로 수동 처리된 학생은 교실에 있는데도 PRESENT가 아니므로,
      // PRESENT만 거르면 결석 알림이 학부모에게 잘못 발송된다.
      // 강사가 수동으로 ABSENT로 찍은 경우는 시간 기반 정책상 그대로 발송한다.
      const attendedRecords = await prisma.attendanceRecord.findMany({
        where: {
          classId,
          date: midnightUtc,
          studentId: { in: enrolledIds },
          status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EARLY_LEAVE] },
        },
        select: { studentId: true },
      });
      const attendedSet = new Set(attendedRecords.map((r) => r.studentId));
      const candidates = enrolledIds.filter((sid) => !attendedSet.has(sid));
      if (candidates.length === 0) continue;
      stats.studentsTargeted += candidates.length;

      // 템플릿을 먼저 확인한다 — 없으면 dedup 로그를 소비하지 않고 건너뛴다.
      // (로그를 먼저 박으면 시드 후에도 다음 cron에서 영영 재시도되지 않으므로)
      const tplCode = kind === 'LATE' ? 'ATTENDANCE_LATE_AUTO' : 'ATTENDANCE_ABSENT_AUTO';
      const tpl = await prisma.notificationTemplate.findUnique({
        where: { academyId_code: { academyId, code: tplCode } },
      });
      if (!tpl) {
        console.warn(`[cron/attendance-notify] missing template ${tplCode} for academy ${academyId}`);
        continue;
      }

      const students = await prisma.student.findMany({
        where: { id: { in: candidates } },
        select: {
          id: true,
          name: true,
          parentLinks: {
            select: {
              parent: { select: { userId: true } },
            },
          },
        },
      });

      const classTime = `${sched.startTime} - ${sched.endTime}`;
      const thresholdMin = kind === 'LATE' ? lateMin : absentMin;

      for (const s of students) {
        const vars = {
          학생명: s.name,
          수업명: sched.class.name,
          수업시간: classTime,
          임계분: thresholdMin,
        };
        const title = renderTemplate(tpl.title, vars);
        const content = renderTemplate(tpl.content, vars);

        // dedup 로그 + in-app 알림을 한 트랜잭션으로 묶는다.
        // - 로그 INSERT가 UNIQUE 충돌(P2002)이면 이미 발송됨 → skip
        // - 알림 생성이 실패하면 로그도 함께 롤백되어 다음 cron에서 재시도된다(영구 누락 방지)
        try {
          await prisma.$transaction(async (tx) => {
            await tx.attendanceNotificationLog.create({
              data: { academyId, classId, studentId: s.id, date: midnightUtc, kind },
            });
            await tx.notification.create({
              data: {
                academyId,
                type: 'ATTENDANCE_ALERT',
                title,
                content,
                sentById: '', // system 발송 (빈 문자열은 기존 컨벤션 유지)
                recipients: { create: { studentId: s.id } },
              },
            });
          });
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code;
          if (code === 'P2002') {
            stats.alertsSkipped += 1;
            continue;
          }
          console.warn('[cron/attendance-notify] notify tx error:', err);
          continue;
        }

        // Web Push는 best-effort — 실패해도 in-app 알림은 이미 저장됨(재발송 안 함).
        const parentUserIds = s.parentLinks
          .map((l) => l.parent.userId)
          .filter((v): v is string => Boolean(v));
        if (parentUserIds.length > 0) {
          await sendPushToUserIds(parentUserIds, {
            title,
            body: content,
            url: '/mobile/notifications',
            studentId: s.id,
            tag: `attendance-${kind.toLowerCase()}-${s.id}-${midnightUtc.toISOString().slice(0, 10)}`,
          });
        }
        stats.alertsSent += 1;
      }
    }

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error('[cron/attendance-notify] fatal:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
