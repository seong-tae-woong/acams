import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { syncSiblingDiscountsForStudent } from '@/lib/utils/billing';
import { StudentStatus } from '@/generated/prisma/client';

function toProxyUrl(blobUrl: string): string {
  if (!blobUrl || !blobUrl.includes('blob.vercel-storage.com')) return blobUrl;
  return `/api/gallery-proxy?url=${encodeURIComponent(blobUrl)}`;
}

// GET /api/settings/academy — 현재 로그인된 원장의 학원 프로필 조회
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

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
        siblingDiscountDefault: true,
        siblingDiscountType: true,
        smsEnabled: true,
        attendanceNotifyEnabled: true,
        attendanceLateMinutes: true,
        attendanceAbsentMinutes: true,
      },
    });

    if (!academy) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });

    return NextResponse.json({
      ...academy,
      galleryImages: ((academy.galleryImages as string[] | null) ?? []).map(toProxyUrl),
    });
  } catch (err) {
    console.error('[GET /api/settings/academy]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/settings/academy — 공개 프로필 저장
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
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
      // 청구 설정
      siblingDiscountDefault,
      siblingDiscountType,
      // 알림 설정
      smsEnabled,
      // 자동 알림 (결석/지각)
      attendanceNotifyEnabled,
      attendanceLateMinutes,
      attendanceAbsentMinutes,
    } = body;

    // 임계값 검증: 정수, 1 <= late < absent <= 60
    const lateNum = typeof attendanceLateMinutes === 'number' ? Math.trunc(attendanceLateMinutes) : undefined;
    const absentNum = typeof attendanceAbsentMinutes === 'number' ? Math.trunc(attendanceAbsentMinutes) : undefined;
    if (lateNum !== undefined && (lateNum < 1 || lateNum > 59)) {
      return NextResponse.json({ error: '지각 임계값은 1-59분 범위여야 합니다.' }, { status: 400 });
    }
    if (absentNum !== undefined && (absentNum < 2 || absentNum > 60)) {
      return NextResponse.json({ error: '결석 임계값은 2-60분 범위여야 합니다.' }, { status: 400 });
    }
    // 두 값이 함께 들어온 경우, 그리고 한 값만 들어온 경우(저장된 값과 비교) 모두 검증
    if (lateNum !== undefined || absentNum !== undefined) {
      const current = await prisma.academy.findUnique({
        where: { id: academyId },
        select: { attendanceLateMinutes: true, attendanceAbsentMinutes: true },
      });
      const nextLate = lateNum ?? current?.attendanceLateMinutes ?? 10;
      const nextAbsent = absentNum ?? current?.attendanceAbsentMinutes ?? 20;
      if (nextLate >= nextAbsent) {
        return NextResponse.json({ error: '지각 임계값은 결석 임계값보다 작아야 합니다.' }, { status: 400 });
      }
    }

    // galleryImages: 명시적으로 전달된 경우에만 업데이트 (미전달 시 기존 값 유지)
    const cleanImages = Array.isArray(galleryImages)
      ? galleryImages.filter((u: string) => u.trim()).slice(0, 6)
      : null;

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
        ...(cleanImages !== null && { galleryImages: cleanImages }),
        ...(siblingDiscountDefault !== undefined && typeof siblingDiscountDefault === 'number' && siblingDiscountDefault >= 0
          && { siblingDiscountDefault: Math.round(siblingDiscountDefault) }),
        ...(siblingDiscountType !== undefined && (siblingDiscountType === 'fixed' || siblingDiscountType === 'percent')
          && { siblingDiscountType }),
        ...(smsEnabled !== undefined && { smsEnabled: Boolean(smsEnabled) }),
        ...(attendanceNotifyEnabled !== undefined && { attendanceNotifyEnabled: Boolean(attendanceNotifyEnabled) }),
        ...(lateNum !== undefined && { attendanceLateMinutes: lateNum }),
        ...(absentNum !== undefined && { attendanceAbsentMinutes: absentNum }),
      },
      select: { slug: true, profileEnabled: true },
    });

    // 형제 할인 설정이 바뀌었으면 학원 전체 학생 재동기화
    const siblingChanged = (siblingDiscountDefault !== undefined && typeof siblingDiscountDefault === 'number')
      || (siblingDiscountType === 'fixed' || siblingDiscountType === 'percent');
    if (siblingChanged) {
      const students = await prisma.student.findMany({
        where: { academyId, status: StudentStatus.ACTIVE },
        select: { id: true },
      });
      // 순차 호출 — DB 동시 트랜잭션 폭주 방지
      for (const s of students) {
        await syncSiblingDiscountsForStudent(s.id);
      }
    }

    return NextResponse.json({ success: true, slug: updated.slug, profileEnabled: updated.profileEnabled });
  } catch (err) {
    console.error('[PATCH /api/settings/academy]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
