import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/settings/academy — 현재 로그인된 원장의 학원 프로필 조회
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: {
        name: true,
        slug: true,
        phone: true,
        address: true,
        intro: true,
        directorName: true,
        businessNumber: true,
        operatingHours: true,
        refundPolicy: true,
        showFees: true,
        profileEnabled: true,
        kakaoMapUrl: true,
        galleryImages: true,
      },
    });

    if (!academy) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });

    return NextResponse.json({
      ...academy,
      galleryImages: (academy.galleryImages as string[] | null) ?? [],
    });
  } catch (err) {
    console.error('[GET /api/settings/academy]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/settings/academy — 공개 프로필 저장
export async function PATCH(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const role      = req.headers.get('x-user-role');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'director') return NextResponse.json({ error: '원장만 수정할 수 있습니다.' }, { status: 403 });

  try {
    const body = await req.json();

    const {
      intro, directorName, businessNumber,
      operatingHours, refundPolicy,
      showFees, profileEnabled,
      kakaoMapUrl, galleryImages,
      // 기본 정보도 함께 저장
      phone, address,
    } = body;

    // galleryImages: 빈 문자열 제거 후 최대 6개
    const cleanImages = Array.isArray(galleryImages)
      ? galleryImages.filter((u: string) => u.trim()).slice(0, 6)
      : [];

    const updated = await prisma.academy.update({
      where: { id: academyId },
      data: {
        ...(phone        !== undefined && { phone }),
        ...(address      !== undefined && { address }),
        ...(intro        !== undefined && { intro }),
        ...(directorName !== undefined && { directorName }),
        ...(businessNumber !== undefined && { businessNumber }),
        ...(operatingHours !== undefined && { operatingHours }),
        ...(refundPolicy !== undefined && { refundPolicy }),
        ...(showFees     !== undefined && { showFees: Boolean(showFees) }),
        ...(profileEnabled !== undefined && { profileEnabled: Boolean(profileEnabled) }),
        ...(kakaoMapUrl  !== undefined && { kakaoMapUrl }),
        galleryImages: cleanImages,
      },
      select: { slug: true, profileEnabled: true },
    });

    return NextResponse.json({ success: true, slug: updated.slug, profileEnabled: updated.profileEnabled });
  } catch (err) {
    console.error('[PATCH /api/settings/academy]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
