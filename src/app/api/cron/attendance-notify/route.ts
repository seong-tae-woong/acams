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

const CRON_INTERVAL_MIN = 5;

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
      const kind: WindowKind = classifyWindow(nowMin, startMin, lateMin, absentMin, CRON_INTERVAL_MIN);
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

      // 중복 발송 방지: INSERT 시도 → UNIQUE 충돌(P2002)이면 이미 보냄
      const freshIds: string[] = [];
      for (const studentId of candidates) {
        try {
          await prisma.attendanceNotificationLog.create({
            data: { academyId, classId, studentId, date: midnightUtc, kind },
          });
          freshIds.push(studentId);
        } catch (err: unknown) {
          // P2002 = unique constraint violation → 이미 발송됨
          const code = (err as { code?: string })?.code;
          if (code === 'P2002') {
            stats.alertsSkipped += 1;
            continue;
          }
          console.warn('[cron/attendance-notify] log insert error:', err);
        }
      }
      if (freshIds.length === 0) continue;

      // 템플릿 + 학생/학부모 정보 한 번에 로드
      const tplCode = kind === 'LATE' ? 'ATTENDANCE_LATE_AUTO' : 'ATTENDANCE_ABSENT_AUTO';
      const [tpl, students] = await Promise.all([
        prisma.notificationTemplate.findUnique({
          where: { academyId_code: { academyId, code: tplCode } },
        }),
        prisma.student.findMany({
          where: { id: { in: freshIds } },
          select: {
            id: true,
            name: true,
            parentLinks: {
              select: {
                parent: { select: { userId: true } },
              },
            },
          },
        }),
      ]);

      if (!tpl) {
        console.warn(`[cron/attendance-notify] missing template ${tplCode} for academy ${academyId}`);
        // 시드 없으면 발송 못 함 — log는 이미 들어갔으므로 다음 cron에서 retry 안 됨.
        // 운영 케이스로 alerting 필요시 audit log 추가 고려.
        continue;
      }

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

        // PWA 알림 페이지에 보이도록 Notification + NotificationRecipient 생성
        await prisma.notification.create({
          data: {
            academyId,
            type: 'ATTENDANCE_ALERT',
            title,
            content,
            sentById: '', // system 발송 (빈 문자열은 기존 컨벤션 유지)
            recipients: { create: { studentId: s.id } },
          },
        });

        // Web Push: 학부모 userId만 (학생 본인 제외)
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
