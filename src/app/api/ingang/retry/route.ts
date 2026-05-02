import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET /api/ingang/retry
// pending: 최대 응시 초과 학생 목록
// history: 재응시 허용 이력
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 각 학생×퀴즈의 응시 횟수 집계
    const quizzes = await prisma.lectureQuiz.findMany({
      where: { academyId },
      select: {
        id: true,
        maxTries: true,
        passScore: true,
        lecture: { select: { id: true, title: true } },
        attempts: {
          select: {
            studentId: true,
            score: true,
            isPassed: true,
            createdAt: true,
            student: { select: { name: true } },
          },
        },
        retryPerms: {
          select: {
            id: true,
            studentId: true,
            usedAt: true,
            createdAt: true,
            student: { select: { name: true } },
            allowedBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // pending: 응시 횟수 >= maxTries이고 미합격인 학생
    const pending: {
      studentId: string;
      student: string;
      lectureTitle: string;
      quizId: string;
      tries: number;
      maxTries: number;
      bestScore: number;
    }[] = [];

    for (const quiz of quizzes) {
      // 학생별 그룹핑
      const byStudent: Record<string, typeof quiz.attempts> = {};
      for (const a of quiz.attempts) {
        if (!byStudent[a.studentId]) byStudent[a.studentId] = [];
        byStudent[a.studentId].push(a);
      }

      // 허용된 추가 응시 횟수
      const retryCountByStudent: Record<string, number> = {};
      for (const p of quiz.retryPerms) {
        retryCountByStudent[p.studentId] = (retryCountByStudent[p.studentId] ?? 0) + 1;
      }

      for (const [studentId, attempts] of Object.entries(byStudent)) {
        const passed = attempts.some((a) => a.isPassed);
        if (passed) continue;
        const maxAllowed = quiz.maxTries + (retryCountByStudent[studentId] ?? 0);
        if (attempts.length >= maxAllowed) {
          const bestScore = Math.max(...attempts.map((a) => a.score));
          pending.push({
            studentId,
            student: attempts[0].student.name,
            lectureTitle: quiz.lecture.title,
            quizId: quiz.id,
            tries: attempts.length,
            maxTries: maxAllowed,
            bestScore,
          });
        }
      }
    }

    // history: 재응시 허용 이력
    const history = quizzes.flatMap((quiz) =>
      quiz.retryPerms.map((p) => {
        const studentAttempts = quiz.attempts.filter((a) => a.studentId === p.studentId);
        const afterPerm = studentAttempts.filter((a) => a.createdAt > p.createdAt);
        let result: string;
        if (!p.usedAt) {
          result = '미응시';
        } else if (afterPerm.some((a) => a.isPassed)) {
          const best = Math.max(...afterPerm.map((a) => a.score));
          result = `합격 (${best}점)`;
        } else if (afterPerm.length > 0) {
          const best = Math.max(...afterPerm.map((a) => a.score));
          result = `불합격 (${best}점)`;
        } else {
          result = '미응시';
        }
        return {
          id: p.id,
          student: p.student.name,
          lectureTitle: quiz.lecture.title,
          allowedBy: p.allowedBy.name,
          createdAt: p.createdAt.toISOString(),
          result,
          passed: result.startsWith('합격'),
        };
      })
    );

    return NextResponse.json({ pending, history });
  } catch (err) {
    console.error('[GET /api/ingang/retry]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/ingang/retry
// { quizId, studentId } → 재응시 1회 허용
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const userId    = req.headers.get('x-user-id');
  if (!academyId || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { quizId, studentId } = await req.json();
    if (!quizId || !studentId) {
      return NextResponse.json({ error: 'quizId, studentId는 필수입니다.' }, { status: 400 });
    }

    const quiz = await prisma.lectureQuiz.findFirst({ where: { id: quizId, academyId } });
    if (!quiz) return NextResponse.json({ error: '퀴즈를 찾을 수 없습니다.' }, { status: 404 });

    const perm = await prisma.lectureRetryPermission.create({
      data: { academyId, quizId, studentId, allowedById: userId },
    });

    return NextResponse.json(perm, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ingang/retry]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
