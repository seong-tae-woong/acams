import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { encryptTossKey, decryptTossKey, maskTossKey } from '@/lib/crypto/tossKey';

function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/super-admin/academies/[id]/toss-key
// 현재 등록된 키 상태를 반환 (secret key는 마스킹)
export async function GET(req: NextRequest, ctx: RouteContext) {
  if (!isSuperAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const academy = await prisma.academy.findUnique({
    where: { id },
    select: { tossClientKey: true, tossSecretKeyEnc: true, tossKeyUpdatedAt: true, tossKeyUpdatedBy: true },
  });

  if (!academy) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });

  let secretKeyMasked: string | null = null;
  if (academy.tossSecretKeyEnc) {
    try {
      const plain = decryptTossKey(academy.tossSecretKeyEnc);
      secretKeyMasked = maskTossKey(plain);
    } catch {
      secretKeyMasked = '****복호화 오류****';
    }
  }

  return NextResponse.json({
    clientKey: academy.tossClientKey ?? null,
    secretKeyMasked,
    isRegistered: !!(academy.tossClientKey && academy.tossSecretKeyEnc),
    updatedAt: academy.tossKeyUpdatedAt ?? null,
    updatedBy: academy.tossKeyUpdatedBy ?? null,
  });
}

// PATCH /api/super-admin/academies/[id]/toss-key
// 토스 클라이언트/시크릿 키 등록 또는 교체
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  if (!isSuperAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const userId = req.headers.get('x-user-id') ?? 'unknown';

  const existing = await prisma.academy.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });

  const body = await req.json();
  const { clientKey, secretKey } = body as { clientKey?: string; secretKey?: string };

  // 키 형식 검증 (test_ck_ / live_ck_ / test_sk_ / live_sk_)
  if (!clientKey || !secretKey) {
    return NextResponse.json({ error: 'clientKey와 secretKey를 모두 입력해주세요.' }, { status: 400 });
  }
  if (!/^(test|live)_ck_/.test(clientKey.trim())) {
    return NextResponse.json({ error: 'Client Key 형식이 올바르지 않습니다. (test_ck_ 또는 live_ck_ 로 시작)' }, { status: 400 });
  }
  if (!/^(test|live)_sk_/.test(secretKey.trim())) {
    return NextResponse.json({ error: 'Secret Key 형식이 올바르지 않습니다. (test_sk_ 또는 live_sk_ 로 시작)' }, { status: 400 });
  }

  // client/secret 환경 일치 여부 확인 (test 끼리, live 끼리)
  const clientEnv = clientKey.trim().startsWith('test_') ? 'test' : 'live';
  const secretEnv = secretKey.trim().startsWith('test_') ? 'test' : 'live';
  if (clientEnv !== secretEnv) {
    return NextResponse.json({ error: 'Client Key와 Secret Key의 환경(test/live)이 일치해야 합니다.' }, { status: 400 });
  }

  let secretKeyEnc: string;
  try {
    secretKeyEnc = encryptTossKey(secretKey.trim());
  } catch (e) {
    console.error('[toss-key PATCH] 암호화 오류:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: '키 암호화에 실패했습니다. TOSS_KEY_ENC_SECRET 환경변수를 확인해주세요.' }, { status: 500 });
  }

  await prisma.academy.update({
    where: { id },
    data: {
      tossClientKey:    clientKey.trim(),
      tossSecretKeyEnc: secretKeyEnc,
      tossKeyUpdatedAt: new Date(),
      tossKeyUpdatedBy: userId,
    },
  });

  return NextResponse.json({ success: true, clientEnv });
}
