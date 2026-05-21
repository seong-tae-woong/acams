import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { MakeupSlotType, MakeupApplySource } from '@/generated/prisma/client';

interface StudentEligibility {
  studentId: string;
  applySource: MakeupApplySource;
}

// 권한·자격 검증: 요청한 studentId가 학부모/학생 본인의 자녀이거나 본인인지 확인
async function resolveEligibility(
  academyId: string,
  userId: string,
  role: string,
  requestedStudentId: string,
  slotOriginalClassId: string,
): Promise<{ ok: true; eligibility: StudentEligibility } | { ok: false; error: string; status: number }> {
  if (role === 'student') {
    const s = await prisma.student.findFirst({
      where: { userId, academyId },
      select: { id: true },
    });
    if (!s || s.id !== requestedStudentId) {
      return { ok: false, error: '본인 신청만 가능합니다.', status: 403 };
    }
  } else if (role === 'parent') {
    const parent = await prisma.parent.findFirst({
      where: { userId },
      include: { children: { include: { student: { select: { id: true, academyId: true } } } } },
    });
    const isMyChild = parent?.children.some(
      (c) => c.student.id === requestedStudentId && c.student.academyId === academyId,
    );
    if (!isMyChild) {
      return { ok: false, error: '본인의 자녀만 신청할 수 있습니다.', status: 403 };
    }
  } else {
    return { ok: false, error: '권한이 없습니다.', status: 403 };
  }

  // 슬롯의 originalClassId에 학생이 활성 등록되어 있는지
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { studentId: requestedStudentId, classId: slotOriginalClassId, isActive: true },
    select: { id: true },
  });
  if (!enrollment) {
    return { ok: false, error: '해당 반에 등록된 학생만 신청할 수 있습니다.', status: 403 };
  }

  return {
    ok: true,
    eligibility: {
      studentId: requestedStudentId,
      applySource: role === 'student' ? MakeupApplySource.SELF : MakeupApplySource.PARENT,
    },
  };
}

// POST /api/mobile/makeup/slots/[id]/apply
// body: { studentId }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  const { id: slotId } = await ctx.params;

  try {
    const { studentId } = await req.json();
    if (!studentId) {
      return NextResponse.json({ error: 'studentId 필수' }, { status: 400 });
    }

    const slot = await prisma.makeupClass.findFirst({
      where: { id: slotId, academyId, slotType: MakeupSlotType.OPEN },
      include: { targets: { select: { studentId: true } } },
    });
    if (!slot) {
      return NextResponse.json({ error: '오픈 슬롯을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 마감 검증
    if (slot.applicationDeadline && new Date() >= slot.applicationDeadline) {
      return NextResponse.json({ error: '신청 마감이 지났습니다.' }, { status: 400 });
    }

    // 정원 검증
    if (slot.capacity != null && slot.targets.length >= slot.capacity) {
      return NextResponse.json({ error: '정원이 마감되었습니다.' }, { status: 400 });
    }

    // 중복 검증
    if (slot.targets.some((t) => t.studentId === studentId)) {
      return NextResponse.json({ error: '이미 신청한 슬롯입니다.' }, { status: 400 });
    }

    // 자격 검증
    const elig = await resolveEligibility(academyId, userId, role, studentId, slot.originalClassId);
    if (!elig.ok) {
      return NextResponse.json({ error: elig.error }, { status: elig.status });
    }

    // 트랜잭션으로 정원 race condition 한 번 더 가드
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.makeupClass.findUnique({
        where: { id: slotId },
        include: { targets: { select: { studentId: true } } },
      });
      if (!fresh) throw new Error('SLOT_GONE');
      if (fresh.capacity != null && fresh.targets.length >= fresh.capacity) {
        throw new Error('CAPACITY');
      }
      if (fresh.targets.some((t) => t.studentId === studentId)) {
        throw new Error('DUPLICATE');
      }
      await tx.makeupClassTarget.create({
        data: {
          makeupClassId: slotId,
          studentId,
          appliedBy: elig.eligibility.applySource,
          appliedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'CAPACITY') return NextResponse.json({ error: '정원이 마감되었습니다.' }, { status: 400 });
    if (msg === 'DUPLICATE') return NextResponse.json({ error: '이미 신청한 슬롯입니다.' }, { status: 400 });
    if (msg === 'SLOT_GONE') return NextResponse.json({ error: '슬롯이 삭제되었습니다.' }, { status: 404 });
    console.error('[POST /api/mobile/makeup/slots/[id]/apply]', msg);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/mobile/makeup/slots/[id]/apply
// body: { studentId } (또는 query)
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  const { id: slotId } = await ctx.params;

  try {
    let studentId: string | null = null;
    try {
      const body = await req.json();
      studentId = body?.studentId ?? null;
    } catch {
      // 본문 없을 수 있음 — query에서 시도
    }
    if (!studentId) {
      const { searchParams } = new URL(req.url);
      studentId = searchParams.get('studentId');
    }
    if (!studentId) {
      return NextResponse.json({ error: 'studentId 필수' }, { status: 400 });
    }

    const slot = await prisma.makeupClass.findFirst({
      where: { id: slotId, academyId, slotType: MakeupSlotType.OPEN },
      select: { id: true, applicationDeadline: true, originalClassId: true },
    });
    if (!slot) {
      return NextResponse.json({ error: '오픈 슬롯을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 마감 후엔 셀프 취소 불가 (학원 문의)
    if (slot.applicationDeadline && new Date() >= slot.applicationDeadline) {
      return NextResponse.json(
        { error: '신청 마감이 지나 셀프 취소가 불가합니다. 학원에 문의해주세요.' },
        { status: 400 },
      );
    }

    // 자격 검증 (본인 자녀만 취소 가능)
    const elig = await resolveEligibility(academyId, userId, role, studentId, slot.originalClassId);
    if (!elig.ok) {
      return NextResponse.json({ error: elig.error }, { status: elig.status });
    }

    await prisma.makeupClassTarget.deleteMany({
      where: { makeupClassId: slotId, studentId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/mobile/makeup/slots/[id]/apply]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
