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
};

// 학생 ID 목록 → 해당 학생의 user + 학생의 모든 학부모 user → 모든 PushSubscription에 푸시 발송
// 실패한 구독(410/404)은 자동 정리
export async function sendPushToStudents(studentIds: string[], payload: PushPayload): Promise<void> {
  if (studentIds.length === 0) return;
  if (!configureVapid()) {
    console.warn('[sendPush] VAPID not configured, skipping');
    return;
  }

  try {
    // 학생 본인 user
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { userId: true },
    });
    const studentUserIds = students.map((s) => s.userId).filter((v): v is string => v !== null);

    // 학생의 학부모 user
    const parentLinks = await prisma.studentParent.findMany({
      where: { studentId: { in: studentIds } },
      select: { parent: { select: { userId: true } } },
    });
    const parentUserIds = parentLinks.map((l) => l.parent.userId).filter((v): v is string => v !== null);

    const userIds = Array.from(new Set([...studentUserIds, ...parentUserIds]));
    if (userIds.length === 0) return;

    const subs = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    const expiredEndpoints: string[] = [];

    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err: unknown) {
          const e = err as { statusCode?: number };
          if (e.statusCode === 404 || e.statusCode === 410) {
            expiredEndpoints.push(s.endpoint);
          } else {
            console.warn('[sendPush] error:', err);
          }
        }
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
