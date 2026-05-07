import webpush from 'web-push';
import { prisma } from '@/lib/db/prisma';

let vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:noreply@acams.app';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  // 학부모가 자녀 여러 명일 때 푸시를 누르면 해당 자녀로 자동 전환
  studentId?: string;
};

// 학생 ID 목록 → 학생별로 1:1 푸시 발송 (제목에 [학생이름] 자동 prefix)
// 학생 본인 user + 학생의 모든 학부모 user의 모든 PushSubscription에 발송
// 실패한 구독(410/404)은 자동 정리
export async function sendPushToStudents(studentIds: string[], payload: PushPayload): Promise<void> {
  if (studentIds.length === 0) return;
  if (!configureVapid()) {
    console.warn('[sendPush] VAPID not configured, skipping');
    return;
  }

  try {
    // 학생별 이름·본인 userId·학부모 userId 모음
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        name: true,
        userId: true,
        parentLinks: { select: { parent: { select: { userId: true } } } },
      },
    });

    const expiredEndpoints: string[] = [];

    await Promise.all(
      students.map(async (s) => {
        const userIds = [
          s.userId,
          ...s.parentLinks.map((l) => l.parent.userId),
        ].filter((v): v is string => v !== null);
        if (userIds.length === 0) return;

        const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
        if (subs.length === 0) return;

        const perStudentPayload: PushPayload = {
          ...payload,
          title: `[${s.name}] ${payload.title}`,
          studentId: s.id,
        };
        const body = JSON.stringify(perStudentPayload);

        await Promise.allSettled(
          subs.map(async (sub) => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                body,
              );
            } catch (err: unknown) {
              const e = err as { statusCode?: number };
              if (e.statusCode === 404 || e.statusCode === 410) {
                expiredEndpoints.push(sub.endpoint);
              } else {
                console.warn('[sendPush] error:', err);
              }
            }
          }),
        );
      }),
    );

    if (expiredEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[sendPush] fatal:', err instanceof Error ? err.message : String(err));
  }
}

// 반 ID → 활성 수강생 → sendPushToStudents 위임
export async function sendPushToClass(classId: string, payload: PushPayload): Promise<void> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId, isActive: true },
    select: { studentId: true },
  });
  await sendPushToStudents(enrollments.map((e) => e.studentId), payload);
}
