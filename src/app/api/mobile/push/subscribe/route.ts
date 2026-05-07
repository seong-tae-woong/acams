import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// POST /api/mobile/push/subscribe — body: { endpoint, keys: { p256dh, auth } }
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'student' && role !== 'parent') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null;
    const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : null;
    const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : null;
    const userAgent = typeof body?.userAgent === 'string' ? body.userAgent.slice(0, 300) : null;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: '구독 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    // upsert by endpoint — 같은 디바이스 재구독 시 userId/keys 갱신
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh, auth, userAgent },
      create: { userId, endpoint, p256dh, auth, userAgent },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/mobile/push/subscribe]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/mobile/push/subscribe?endpoint=
export async function DELETE(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const endpoint = new URL(req.url).searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ error: 'endpoint는 필수입니다.' }, { status: 400 });

  try {
    // 해당 user의 구독만 삭제 (남의 구독 삭제 방지)
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/mobile/push/subscribe]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
