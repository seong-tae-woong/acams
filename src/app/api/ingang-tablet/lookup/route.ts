/**
 * POST /api/ingang-tablet/lookup
 *
 * 학생이 출결번호를 입력하면 학생 정보 + 수강 반 목록 + 오늘의 인강 list + 강사 코멘트를 반환.
 * IngangViewSession을 PENDING으로 생성.
 * role=tablet 전용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  const academyId = req.headers.get('x-academy-id');
  const tabletUserId = req.headers.get('x-user-id');

  if (role !== 'tablet' || !academyId || !tabletUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { attendanceNumber } = await req.json();
    if (!attendanceNumber?.trim()) {
      return NextResponse.json({ error: '출결번호를 입력해주세요.' }, { status: 400 });
    }

    // 학생 조회
    const student = await prisma.student.findFirst({
      where: { attendanceNumber: attendanceNumber.trim(), academyId },
      select: {
        id: true,
        name: true,
        attendanceNumber: true,
        avatarColor: true,
        classEnrollments: {
          where: { isActive: true },
          include: {
            class: {
              select: {
                id: true,
                name: true,
                subject: true,
                color: true,
                lectureTargets: {
                  include: {
                    lecture: {
                      select: {
                        id: true,
                        title: true,
                        duration: true,
                        seriesId: true,
                        episodeNumber: true,
                        orderIndex: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: '출결번호에 해당하는 학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 기존 PENDING 세션이 있으면 만료 처리
    await prisma.ingangViewSession.updateMany({
      where: { studentId: student.id, academyId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    // 진행 중인 APPROVED 세션도 만료 처리 (다른 태블릿에서 이미 시청 중인 경우 강제 종료)
    await prisma.ingangViewSession.updateMany({
      where: { studentId: student.id, academyId, status: 'APPROVED' },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    // 새 PENDING 세션 생성
    const session = await prisma.ingangViewSession.create({
      data: { academyId, studentId: student.id, tabletUserId, status: 'PENDING' },
    });

    // 각 반의 PUBLISHED 인강 목록 + 코멘트 조회
    const classes = await Promise.all(
      student.classEnrollments.map(async (enrollment) => {
        const cls = enrollment.class;
        // 해당 반에 배정된 PUBLISHED 강의
        const lectures = cls.lectureTargets
          .filter((lt) => lt.lecture.status === 'PUBLISHED')
          .sort((a, b) => {
            // seriesId → episodeNumber → orderIndex 순 정렬
            if (a.lecture.seriesId !== b.lecture.seriesId) {
              return (a.lecture.seriesId ?? '').localeCompare(b.lecture.seriesId ?? '');
            }
            if ((a.lecture.episodeNumber ?? 0) !== (b.lecture.episodeNumber ?? 0)) {
              return (a.lecture.episodeNumber ?? 0) - (b.lecture.episodeNumber ?? 0);
            }
            return a.lecture.orderIndex - b.lecture.orderIndex;
          });

        // 각 강의별 학생 코멘트 조회
        const lectureIds = lectures.map((lt) => lt.lecture.id);
        const notes = lectureIds.length > 0
          ? await prisma.studentLectureNote.findMany({
              where: { studentId: student.id, lectureId: { in: lectureIds } },
              select: { lectureId: true, note: true },
            })
          : [];
        const noteMap = Object.fromEntries(notes.map((n) => [n.lectureId, n.note]));

        return {
          classId: cls.id,
          className: cls.name,
          subject: cls.subject,
          color: cls.color,
          lectures: lectures.map((lt) => ({
            lectureId: lt.lecture.id,
            title: lt.lecture.title,
            duration: lt.lecture.duration,
            note: noteMap[lt.lecture.id] ?? null,
          })),
        };
      }),
    );

    return NextResponse.json({
      sessionId: session.id,
      student: {
        id: student.id,
        name: student.name,
        attendanceNumber: student.attendanceNumber,
        avatarColor: student.avatarColor,
      },
      classes,
    });
  } catch (err) {
    console.error('[POST /api/ingang-tablet/lookup]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
