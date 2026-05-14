/**
 * /api/lectures/[id]/student-notes
 *
 * GET  — 이 강의의 모든 학생별 코멘트 목록 (학원 내 활성 학생 대상)
 * PUT  — 특정 학생의 코멘트 upsert (body: { studentId, note })
 * DELETE — 특정 학생의 코멘트 삭제 (?studentId=)
 *
 * teacher·director 전용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function allowedRole(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  return role === 'director' || role === 'teacher';
}

// GET — 강의별 전체 학생 코멘트 목록
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!allowedRole(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: lectureId } = await ctx.params;

  // 이 강의의 LectureTarget classId들로 수강 학생 목록 조회
  const targets = await prisma.lectureTarget.findMany({
    where: { lectureId },
    select: { classId: true },
  });
  const classIds = targets.map((t) => t.classId);

  const [students, notes] = await Promise.all([
    prisma.student.findMany({
      where: {
        academyId,
        status: 'ACTIVE',
        classEnrollments: { some: { classId: { in: classIds }, isActive: true } },
      },
      select: {
        id: true,
        name: true,
        attendanceNumber: true,
        avatarColor: true,
        classEnrollments: {
          where: { classId: { in: classIds }, isActive: true },
          include: { class: { select: { id: true, name: true, color: true } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.studentLectureNote.findMany({
      where: { lectureId, academyId },
      select: { studentId: true, note: true, updatedAt: true },
    }),
  ]);

  const noteMap = Object.fromEntries(notes.map((n) => [n.studentId, { note: n.note, updatedAt: n.updatedAt }]));

  const result = students.map((s) => ({
    studentId: s.id,
    name: s.name,
    attendanceNumber: s.attendanceNumber,
    avatarColor: s.avatarColor,
    classes: s.classEnrollments.map((e) => ({ classId: e.class.id, className: e.class.name, color: e.class.color })),
    note: noteMap[s.id]?.note ?? null,
    updatedAt: noteMap[s.id]?.updatedAt ?? null,
  }));

  return NextResponse.json(result);
}

// PUT — 코멘트 upsert
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!allowedRole(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const academyId = req.headers.get('x-academy-id');
  const authorId = req.headers.get('x-user-id');
  if (!academyId || !authorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: lectureId } = await ctx.params;
  const { studentId, note } = await req.json();

  if (!studentId || typeof note !== 'string') {
    return NextResponse.json({ error: 'studentId와 note가 필요합니다.' }, { status: 400 });
  }

  // 학생·강의 소속 확인
  const [student, lecture] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, academyId } }),
    prisma.lecture.findFirst({ where: { id: lectureId, academyId } }),
  ]);
  if (!student || !lecture) return NextResponse.json({ error: '학생 또는 강의를 찾을 수 없습니다.' }, { status: 404 });

  const updated = await prisma.studentLectureNote.upsert({
    where: { studentId_lectureId: { studentId, lectureId } },
    create: { academyId, studentId, lectureId, note: note.trim(), authorId },
    update: { note: note.trim(), authorId },
    select: { studentId: true, note: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

// DELETE — 코멘트 삭제
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!allowedRole(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: lectureId } = await ctx.params;
  const studentId = new URL(req.url).searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });

  await prisma.studentLectureNote.deleteMany({
    where: { lectureId, studentId, academyId },
  });

  return NextResponse.json({ success: true });
}
