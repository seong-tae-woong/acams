import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@/generated/prisma/client';

/**
 * 서버 에러를 DB(ErrorLog)에 기록한다 — super_admin 전용 진단 로그.
 *
 * - 절대 throw 하지 않는다: 로깅 실패가 본 요청을 막으면 안 된다(writeAuditLog와 동일 원칙).
 * - 작업자/학원 신원은 proxy(src/proxy.ts)가 주입한 헤더에서 추출한다.
 *
 * - source(어느 API인지)는 요청에서 자동 추론한다: "METHOD /api/path".
 *
 * 사용 예 (라우트 catch 블록):
 *   } catch (err) {
 *     await logServerError(req, err, { classId, recordCount }); // context는 선택
 *     return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
 *   }
 */
export async function logServerError(
  req: NextRequest,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const e = error as { code?: string; message?: string; meta?: unknown };
    const rawName = req.headers.get('x-user-name');

    await prisma.errorLog.create({
      data: {
        source: safeSource(req),
        academyId: req.headers.get('x-academy-id') || null,
        userId: req.headers.get('x-user-id') || null,
        userName: rawName ? safeDecode(rawName) : null,
        userRole: req.headers.get('x-user-role') || null,
        code: e?.code ?? null,
        message: (e?.message ?? String(error)).trim().slice(0, 4000),
        meta: buildMeta(e?.meta, context),
      },
    });
  } catch (logErr) {
    // 로깅 실패는 삼킨다 — 본 요청 처리에 영향 주지 않음
    console.error('[logServerError] 기록 실패', logErr instanceof Error ? logErr.message : String(logErr));
  }
}

// 요청에서 "METHOD /api/path" 형태의 source를 추론. URL 파싱 실패해도 안전하게 처리.
function safeSource(req: NextRequest): string {
  try {
    return `${req.method} ${new URL(req.url).pathname}`;
  } catch {
    return req.method ?? 'UNKNOWN';
  }
}

// 헤더의 x-user-name은 URL 인코딩되어 들어옴(한글 대비). 깨진 값이어도 안전하게 처리.
function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

// Prisma 에러의 meta + 호출자가 준 요청 컨텍스트를 하나의 JSON으로 합친다.
function buildMeta(
  prismaMeta: unknown,
  context?: Record<string, unknown>,
): Prisma.InputJsonValue | undefined {
  const merged: Record<string, unknown> = {};
  if (context) Object.assign(merged, context);
  if (prismaMeta !== undefined && prismaMeta !== null) merged.prismaMeta = prismaMeta;
  return Object.keys(merged).length ? (merged as Prisma.InputJsonValue) : undefined;
}
