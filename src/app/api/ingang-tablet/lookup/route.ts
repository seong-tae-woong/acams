/**
 * POST /api/ingang-tablet/lookup
 *
 * 학생이 출결번호를 입력하면 학생 정보 + 수강 반 목록 + 오늘의 인강 list + 강사 코멘트를 반환.
 * IngangViewSession을 PENDING으로 생성.
 * role=tablet 전용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// 반에 속하지 않는 강의(전체 공개·개별 지정)를 묶는 가상 분류 ID
const DIRECT_CLASS_ID = '__direct__';

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
                        targetMode: true,
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
        // 해당 반에 배정된 PUBLISHED + CLASS 모드 강의
        // (다른 모드로 전환된 강의는 반 배정 행이 남아있어도 제외)
        const lectures = cls.lectureTargets
          .filter((lt) => lt.lecture.status === 'PUBLISHED' && lt.lecture.targetMode === 'CLASS')
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

    // 전체 공개(ALL) + 개별 지정(INDIVIDUAL) 강의 — 반과 무관하게 학생에게 노출
    const directLectures = await prisma.lecture.findMany({
      where: {
        academyId,
        status: 'PUBLISHED',
        OR: [
          { targetMode: 'ALL' },
          { targetMode: 'INDIVIDUAL', studentTargets: { some: { studentId: student.id } } },
        ],
      },
      select: { id: true, title: true, duration: true, seriesId: true, episodeNumber: true, orderIndex: true },
    });

    if (directLectures.length > 0) {
      directLectures.sort((a, b) => {
        if (a.seriesId !== b.seriesId) return (a.seriesId ?? '').localeCompare(b.seriesId ?? '');
        if ((a.episodeNumber ?? 0) !== (b.episodeNumber ?? 0)) return (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0);
        return a.orderIndex - b.orderIndex;
      });

      const directNotes = await prisma.studentLectureNote.findMany({
        where: { studentId: student.id, lectureId: { in: directLectures.map((l) => l.id) } },
        select: { lectureId: true, note: true },
      });
      const directNoteMap = Object.fromEntries(directNotes.map((n) => [n.lectureId, n.note]));

      classes.push({
        classId: DIRECT_CLASS_ID,
        className: '개별 배정 강의',
        subject: '',
        color: '#a78bfa',
        lectures: directLectures.map((l) => ({
          lectureId: l.id,
          title: l.title,
          duration: l.duration,
          note: directNoteMap[l.id] ?? null,
        })),
      });
    }

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
