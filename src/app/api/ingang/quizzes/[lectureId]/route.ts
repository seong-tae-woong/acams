import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type Ctx = { params: Promise<{ lectureId: string }> };

// GET /api/ingang/quizzes/[lectureId]
// 해당 강의의 퀴즈(문제 포함) 반환. 퀴즈 없으면 null.
export async function GET(req: NextRequest, ctx: Ctx) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lectureId } = await ctx.params;

  try {
    const quiz = await prisma.lectureQuiz.findUnique({
      where: { lectureId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            options: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    });

    if (!quiz || quiz.academyId !== academyId) {
      return NextResponse.json(null);
    }

    return NextResponse.json(quiz);
  } catch (err) {
    console.error('[GET /api/ingang/quizzes/[lectureId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/ingang/quizzes/[lectureId]
// 퀴즈 전체 저장 (upsert). 기존 문제는 삭제 후 재생성.
export async function PUT(req: NextRequest, ctx: Ctx) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lectureId } = await ctx.params;

  try {
    const { passScore, maxTries, examCond, questions } = await req.json();

    const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, academyId } });
    if (!lecture) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });

    const quiz = await prisma.$transaction(async (tx) => {
      const existing = await tx.lectureQuiz.findUnique({ where: { lectureId } });

      let quizRecord;
      if (existing) {
        // 기존 문제 전체 삭제 후 재생성
        await tx.lectureQuestion.deleteMany({ where: { quizId: existing.id } });
        quizRecord = await tx.lectureQuiz.update({
          where: { id: existing.id },
          data: { passScore, maxTries, examCond },
        });
      } else {
        quizRecord = await tx.lectureQuiz.create({
          data: { academyId, lectureId, passScore, maxTries, examCond },
        });
      }

      // 문제 + 선택지 재생성
      if (Array.isArray(questions)) {
        for (let qi = 0; qi < questions.length; qi++) {
          const q = questions[qi];
          await tx.lectureQuestion.create({
            data: {
              quizId: quizRecord.id,
              orderIndex: qi,
              text: q.text,
              score: q.score,
              options: {
                create: (q.options ?? []).map((o: { text: string; isCorrect: boolean }, oi: number) => ({
                  orderIndex: oi,
                  text: o.text,
                  isCorrect: o.isCorrect,
                })),
              },
            },
          });
        }
      }

      return tx.lectureQuiz.findUnique({
        where: { id: quizRecord.id },
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
            include: { options: { orderBy: { orderIndex: 'asc' } } },
          },
        },
      });
    });

    return NextResponse.json(quiz);
  } catch (err) {
    console.error('[PUT /api/ingang/quizzes/[lectureId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/ingang/quizzes/[lectureId]
// 이수 조건(합격 기준·응시 횟수·응시 조건)만 갱신. 문제는 건드리지 않음.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lectureId } = await ctx.params;

  try {
    const { passScore, maxTries, examCond } = await req.json();

    const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, academyId } });
    if (!lecture) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });

    const quiz = await prisma.lectureQuiz.upsert({
      where: { lectureId },
      update: { passScore, maxTries, examCond },
      create: { academyId, lectureId, passScore, maxTries, examCond },
    });

    return NextResponse.json({ passScore: quiz.passScore, maxTries: quiz.maxTries, examCond: quiz.examCond });
  } catch (err) {
    console.error('[PATCH /api/ingang/quizzes/[lectureId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
