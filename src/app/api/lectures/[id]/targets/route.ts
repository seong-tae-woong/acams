/**
 * /api/lectures/[id]/targets
 *
 * GET — 강의 수강 대상(모드 + 반/학생 목록) 조회.
 * PUT — 수강 대상 저장. targetMode에 따라 반·학생 지정을 교체.
 *
 * 반·학생 ID는 body 값이므로 academyId 소속 여부를 서버에서 재검증한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { LectureTargetMode } from '@/generated/prisma/client';
import { requireAuth } from '@/lib/auth/requireAuth';

type Ctx = { params: Promise<{ id: string }> };

const VALID_MODES: LectureTargetMode[] = ['CLASS', 'INDIVIDUAL', 'ALL'];

// GET /api/lectures/[id]/targets
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const lecture = await prisma.lecture.findFirst({
      where: { id, academyId },
      select: {
        targetMode: true,
        targets: { select: { classId: true } },
        studentTargets: { select: { studentId: true } },
      },
    });
    if (!lecture) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });

    return NextResponse.json({
      targetMode: lecture.targetMode,
      classIds: lecture.targets.map((t) => t.classId),
      studentIds: lecture.studentTargets.map((t) => t.studentId),
    });
  } catch (err) {
    console.error('[GET /api/lectures/[id]/targets]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/lectures/[id]/targets
export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const targetMode = body.targetMode as LectureTargetMode;
    const classIds: string[] = Array.isArray(body.classIds) ? body.classIds : [];
    const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : [];

    if (!VALID_MODES.includes(targetMode)) {
      return NextResponse.json({ error: '잘못된 수강 대상 모드입니다.' }, { status: 400 });
    }

    const lecture = await prisma.lecture.findFirst({ where: { id, academyId } });
    if (!lecture) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });

    // 같은 학원 소속 반/학생만 통과
    const validClasses = classIds.length
      ? await prisma.class.findMany({ where: { id: { in: classIds }, academyId }, select: { id: true } })
      : [];
    const validStudents = studentIds.length
      ? await prisma.student.findMany({ where: { id: { in: studentIds }, academyId }, select: { id: true } })
      : [];

    await prisma.$transaction([
      prisma.lecture.update({ where: { id }, data: { targetMode } }),
      prisma.lectureTarget.deleteMany({ where: { lectureId: id } }),
      prisma.lectureStudentTarget.deleteMany({ where: { lectureId: id } }),
      prisma.lectureTarget.createMany({ data: validClasses.map((c) => ({ lectureId: id, classId: c.id })) }),
      prisma.lectureStudentTarget.createMany({ data: validStudents.map((s) => ({ lectureId: id, studentId: s.id })) }),
    ]);

    return NextResponse.json({
      success: true,
      targetMode,
      classIds: validClasses.map((c) => c.id),
      studentIds: validStudents.map((s) => s.id),
    });
  } catch (err) {
    console.error('[PUT /api/lectures/[id]/targets]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
