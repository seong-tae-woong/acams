import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function formatSchedule(schedules: { dayOfWeek: number; startTime: string; endTime: string }[]) {
  if (!schedules.length) return '';
  const days = schedules.map((s) => DAY_LABEL[s.dayOfWeek]).join('·');
  const { startTime, endTime } = schedules[0];
  return `${days} ${startTime}~${endTime}`;
}

// GET /api/academy/[slug]  — 인증 불필요 (proxy PUBLIC_PATHS에 등록됨)
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  try {
    const academy = await prisma.academy.findUnique({
      where: { slug },
    });

    if (!academy || !academy.isActive) {
      return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!academy.profileEnabled) {
      return NextResponse.json({ error: '준비 중인 페이지입니다.' }, { status: 404 });
    }

    // 수강 과목 목록
    const classes = await prisma.class.findMany({
      where: { academyId: academy.id },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    // 최근 공지사항 3개 (전체 공지만)
    const announcements = await prisma.announcement.findMany({
      where: {
        academyId: academy.id,
        status: 'PUBLISHED',
        classId: null,
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        pinned: true,
      },
    });

    return NextResponse.json({
      name: academy.name,
      slug: academy.slug,
      intro: academy.intro ?? '',
      phone: academy.phone ?? '',
      address: academy.address ?? '',
      directorName: academy.directorName ?? '',
      businessNumber: academy.businessNumber ?? '',
      operatingHours: academy.operatingHours ?? '',
      refundPolicy: academy.refundPolicy ?? '',
      showFees: academy.showFees,
      kakaoMapUrl: academy.kakaoMapUrl ?? '',
      galleryImages: (academy.galleryImages as string[] | null) ?? [],
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        grade: c.grade ?? '',
        fee: academy.showFees ? c.fee : null,
        color: c.color,
        schedule: formatSchedule(c.schedules),
      })),
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content.slice(0, 120) + (a.content.length > 120 ? '…' : ''),
        publishedAt: a.publishedAt?.toISOString().slice(0, 10) ?? '',
        pinned: a.pinned,
      })),
    });
  } catch (err) {
    console.error('[GET /api/academy/[slug]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
