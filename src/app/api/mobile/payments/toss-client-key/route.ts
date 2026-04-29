import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/mobile/payments/toss-client-key
// 현재 학원의 토스 Client Key를 반환 (공개 키이므로 평문 OK)
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
    select: { tossClientKey: true },
  });

  if (!academy?.tossClientKey) {
    return NextResponse.json({ error: '결제가 설정되지 않은 학원입니다.' }, { status: 503 });
  }

  return NextResponse.json({ clientKey: academy.tossClientKey });
}
