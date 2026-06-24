import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { resyncAllSiblingDiscounts } from '@/lib/utils/billing';

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
        introDetail: true,
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
        billingDueDay: true,
        openMakeupApplyLeadHours: true,
      },
    });

    if (!academy) return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });

    return NextResponse.json({
      ...academy,
      galleryImages: ((academy.galleryImages as string[] | null) ?? []).map(toProxyUrl),
    });
  } catch (err) {
    await logServerError(req, err);
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
      intro, introDetail, directorName, businessNumber,
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
      // 청구 납부일 / 오픈 보강 신청 마감
      billingDueDay,
      openMakeupApplyLeadHours,
    } = body;

    // 한 줄 소개는 최대 40자 (히어로 태그라인)
    if (intro !== undefined && typeof intro === 'string' && intro.length > 40) {
      return NextResponse.json({ error: '한 줄 소개는 최대 40자까지 입력할 수 있습니다.' }, { status: 400 });
    }

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

    // 청구 납부일: 1-31일 (월말 초과 시 청구 생성 시 말일로 보정)
    const dueDayNum = typeof billingDueDay === 'number' ? Math.trunc(billingDueDay) : undefined;
    if (dueDayNum !== undefined && (dueDayNum < 1 || dueDayNum > 31)) {
      return NextResponse.json({ error: '청구 납부일은 1-31일 범위여야 합니다.' }, { status: 400 });
    }
    // 오픈 보강 신청 마감 리드타임: 0-720시간(최대 30일)
    const leadHoursNum = typeof openMakeupApplyLeadHours === 'number' ? Math.trunc(openMakeupApplyLeadHours) : undefined;
    if (leadHoursNum !== undefined && (leadHoursNum < 0 || leadHoursNum > 720)) {
      return NextResponse.json({ error: '오픈 보강 신청 마감은 0~720시간(30일) 범위로 설정해주세요.' }, { status: 400 });
    }

    // 결제 활성화 학원은 사업자정보·환불정책 필수 (토스 심사·전자상거래 법정 표시사항)
    // 토스 키가 등록된 학원에서 필수 항목을 비우는 저장을 차단한다.
    const payCheck = await prisma.academy.findUnique({
      where: { id: academyId },
      select: {
        tossClientKey: true, tossSecretKeyEnc: true,
        directorName: true, businessNumber: true, address: true, phone: true, refundPolicy: true,
      },
    });
    const paymentEnabled = !!(payCheck?.tossClientKey && payCheck?.tossSecretKeyEnc);
    if (paymentEnabled) {
      // 전달된 값이 있으면 그 값을, 없으면 기존 저장값을 기준으로 최종 상태를 검증
      const resolved = (incoming: unknown, current: string | null) =>
        incoming !== undefined ? incoming : current;
      const requiredFields: { value: unknown; label: string }[] = [
        { value: resolved(directorName, payCheck!.directorName),     label: '대표자명' },
        { value: resolved(businessNumber, payCheck!.businessNumber), label: '사업자등록번호' },
        { value: resolved(address, payCheck!.address),               label: '주소' },
        { value: resolved(phone, payCheck!.phone),                   label: '연락처' },
        { value: resolved(refundPolicy, payCheck!.refundPolicy),     label: '환불 정책' },
      ];
      const missing = requiredFields
        .filter((f) => typeof f.value !== 'string' || !f.value.trim())
        .map((f) => f.label);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `결제가 활성화된 학원은 다음 항목을 반드시 입력해야 합니다: ${missing.join(', ')}` },
          { status: 400 },
        );
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
        ...(introDetail  !== undefined && { introDetail }),
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
        ...(dueDayNum !== undefined && { billingDueDay: dueDayNum }),
        ...(leadHoursNum !== undefined && { openMakeupApplyLeadHours: leadHoursNum }),
      },
      select: { slug: true, profileEnabled: true },
    });

    // 형제 할인 설정이 바뀌었으면 학원 전체 학생 재동기화
    const siblingChanged = (siblingDiscountDefault !== undefined && typeof siblingDiscountDefault === 'number')
      || (siblingDiscountType === 'fixed' || siblingDiscountType === 'percent');
    if (siblingChanged) {
      await resyncAllSiblingDiscounts(academyId);
    }

    return NextResponse.json({ success: true, slug: updated.slug, profileEnabled: updated.profileEnabled });
  } catch (err) {
    await logServerError(req, err);
    console.error('[PATCH /api/settings/academy]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
