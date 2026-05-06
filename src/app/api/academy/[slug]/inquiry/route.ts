import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { isRateLimited, getRemainingSeconds, getClientIp } from '@/lib/auth/rateLimit';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// POST /api/academy/[slug]/inquiry — 공개 페이지 상담 신청 (인증 불필요)
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  // IP 기반 rate limit — 스팸 문의 방지 (시간당 5회)
  const ip = getClientIp(req);
  if (isRateLimited(`inquiry:${ip}`, 5, 60 * 60 * 1000)) {
    const secs = getRemainingSeconds(`inquiry:${ip}`);
    return NextResponse.json(
      { error: `문의가 너무 많습니다. ${Math.ceil(secs / 60)}분 후 다시 시도해주세요.` },
      { status: 429, headers: { 'Retry-After': String(secs) } },
    );
  }

  const { slug } = await ctx.params;

  try {
    const { name, phone, classId, className, message } = await req.json();

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다.' }, { status: 400 });
    }

    const academy = await prisma.academy.findUnique({
      where: { slug },
      select: { id: true, profileEnabled: true },
    });
    if (!academy) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });
    if (!academy.profileEnabled) return NextResponse.json({ error: '비활성 페이지입니다.' }, { status: 403 });

    const inquiry = await prisma.publicInquiry.create({
      data: {
        academyId: academy.id,
        name: name.trim(),
        phone: phone.trim(),
        classId: classId || null,
        className: className?.trim() || null,
        message: message?.trim() || '',
      },
    });

    return NextResponse.json({ id: inquiry.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/academy/[slug]/inquiry]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
