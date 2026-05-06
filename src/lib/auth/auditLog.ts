import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@/generated/prisma/client';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGIN_LOCKED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGE'
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_DEACTIVATED';

export async function writeAuditLog(options: {
  action: AuditAction;
  userId?: string;
  role?: string;
  academyId?: string;
  target?: string;
  detail?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: options.action,
        userId: options.userId ?? null,
        role: options.role ?? null,
        academyId: options.academyId ?? null,
        target: options.target ?? null,
        detail: (options.detail ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: options.ipAddress ?? null,
      },
    });
  } catch (err) {
    // 감사 로그 실패가 메인 요청을 막으면 안 됨
    console.error('[AuditLog] 기록 실패:', err instanceof Error ? err.message : String(err));
  }
}
