import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { MakeupSlotType } from '@/generated/prisma/client';

// GET /api/mobile/makeup/slots
// 학부모/학생 본인이 등록된 반의 OPEN 슬롯 목록 (makeupDate >= today)
// + 각 자녀별 신청 여부 동시 표현
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  try {
    // 자녀(=신청 가능 학생) 목록 수집
    let students: { id: string; name: string }[] = [];
    if (role === 'student') {
      const s = await prisma.student.findFirst({
        where: { userId, academyId },
        select: { id: true, name: true },
      });
      if (s) students = [s];
    } else if (role === 'parent') {
      const parent = await prisma.parent.findFirst({
        where: { userId },
        include: {
          children: {
            include: { student: { select: { id: true, name: true, academyId: true } } },
          },
        },
      });
      students = (parent?.children ?? [])
        .filter((c) => c.student.academyId === academyId)
        .map((c) => ({ id: c.student.id, name: c.student.name }));
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    if (students.length === 0) {
      return NextResponse.json({ children: [], slots: [] });
    }

    // 자녀가 활성으로 등록된 반들
    const enrollments = await prisma.classEnrollment.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, isActive: true },
      select: { studentId: true, classId: true },
    });
    const studentToClasses = new Map<string, Set<string>>();
    enrollments.forEach((e) => {
      if (!studentToClasses.has(e.studentId)) studentToClasses.set(e.studentId, new Set());
      studentToClasses.get(e.studentId)!.add(e.classId);
    });
    const allClassIds = Array.from(new Set(enrollments.map((e) => e.classId)));
    if (allClassIds.length === 0) {
      return NextResponse.json({ children: students, slots: [] });
    }

    // 미래 OPEN 슬롯 (이미 시작된 슬롯도 포함하려면 today 비교 안 함 — 일단 미래만)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const slots = await prisma.makeupClass.findMany({
      where: {
        academyId,
        slotType: MakeupSlotType.OPEN,
        originalClassId: { in: allClassIds },
        makeupDate: { gte: todayStart },
      },
      include: {
        originalClass: { select: { id: true, name: true, color: true } },
        teacher: { select: { name: true } },
        targets: { select: { studentId: true } },
      },
      orderBy: { makeupDate: 'asc' },
    });

    const data = slots.map((slot) => {
      const filledCount = slot.targets.length;
      const remaining = slot.capacity != null ? Math.max(0, slot.capacity - filledCount) : null;
      const deadlinePassed = slot.applicationDeadline ? new Date() >= slot.applicationDeadline : false;
      // 어떤 자녀가 신청 가능한가? — 1) 등록된 반인 학생만, 2) 이미 신청 안 했어야
      const enrolledStudentIds = students
        .filter((s) => studentToClasses.get(s.id)?.has(slot.originalClassId))
        .map((s) => s.id);
      const appliedStudentIds = slot.targets
        .map((t) => t.studentId)
        .filter((sid) => enrolledStudentIds.includes(sid));
      return {
        id: slot.id,
        classId: slot.originalClass.id,
        className: slot.originalClass.name,
        classColor: slot.originalClass.color,
        teacherName: slot.teacher.name,
        makeupDate: slot.makeupDate.toISOString().slice(0, 10),
        makeupTime: slot.makeupTime,
        reason: slot.reason,
        capacity: slot.capacity,
        filledCount,
        remaining,
        applicationDeadline: slot.applicationDeadline ? slot.applicationDeadline.toISOString() : null,
        deadlinePassed,
        // 자녀별 신청/가능 여부
        eligibleStudentIds: enrolledStudentIds,
        appliedStudentIds,
      };
    });

    return NextResponse.json({ children: students, slots: data });
  } catch (err) {
    console.error('[GET /api/mobile/makeup/slots]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
