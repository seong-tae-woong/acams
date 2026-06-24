import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { isRateLimited, getRemainingSeconds, getClientIp } from '@/lib/auth/rateLimit';

// POST /api/intro/inquiry — 마케팅 페이지 상담 신청 (인증 불필요)
export async function POST(req: NextRequest) {
  // IP 기반 rate limit — 스팸 신청 방지 (시간당 5회)
  const ip = getClientIp(req);
  if (isRateLimited(`demo:${ip}`, 5, 60 * 60 * 1000)) {
    const secs = getRemainingSeconds(`demo:${ip}`);
    return NextResponse.json(
      { error: `신청이 너무 많습니다. ${Math.ceil(secs / 60)}분 후 다시 시도해주세요.` },
      { status: 429, headers: { 'Retry-After': String(secs) } },
    );
  }

  try {
    const { name, phone, academyName, studentCount, message } = await req.json();

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다.' }, { status: 400 });
    }

    const request = await prisma.demoRequest.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        academyName: academyName?.trim() || '',
        studentCount: studentCount?.trim() || '',
        message: message?.trim() || '',
      },
    });

    return NextResponse.json({ id: request.id }, { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/intro/inquiry]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
