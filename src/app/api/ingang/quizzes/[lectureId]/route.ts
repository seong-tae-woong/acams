import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { coerceExamCond, isYouTubeLecture } from '@/lib/lecture/source';

type Ctx = { params: Promise<{ lectureId: string }> };

// GET /api/ingang/quizzes/[lectureId]
// 해당 강의의 퀴즈(문제 포함) 반환. 퀴즈 없으면 null.
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

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
    await logServerError(req, err);
    console.error('[GET /api/ingang/quizzes/[lectureId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/ingang/quizzes/[lectureId]
// 퀴즈 전체 저장 (upsert). 기존 문제는 삭제 후 재생성.
export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { lectureId } = await ctx.params;

  try {
    const { passScore, maxTries, examCond, passWatchPct, questions } = await req.json();

    const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, academyId } });
    if (!lecture) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });

    // YouTube 강의는 시청률 추적 불가 → examCond를 'anytime'으로 강제 (UI 가드의 fallback)
    const safeExamCond = coerceExamCond(lecture, examCond);
    if (isYouTubeLecture(lecture) && examCond === 'after100') {
      console.warn(`[PUT quizzes/${lectureId}] examCond coerced after100→anytime (YouTube lecture)`);
    }

    const pctClamped =
      typeof passWatchPct === 'number' && Number.isFinite(passWatchPct)
        ? Math.max(50, Math.min(100, Math.round(passWatchPct)))
        : undefined;

    const quiz = await prisma.$transaction(async (tx) => {
      const existing = await tx.lectureQuiz.findUnique({ where: { lectureId } });

      let quizRecord;
      if (existing) {
        // 기존 문제 전체 삭제 후 재생성
        await tx.lectureQuestion.deleteMany({ where: { quizId: existing.id } });
        quizRecord = await tx.lectureQuiz.update({
          where: { id: existing.id },
          data: {
            passScore, maxTries, examCond: safeExamCond,
            ...(pctClamped !== undefined ? { passWatchPct: pctClamped } : {}),
          },
        });
      } else {
        quizRecord = await tx.lectureQuiz.create({
          data: {
            academyId, lectureId, passScore, maxTries, examCond: safeExamCond,
            passWatchPct: pctClamped ?? 100,
          },
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
    await logServerError(req, err);
    console.error('[PUT /api/ingang/quizzes/[lectureId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH /api/ingang/quizzes/[lectureId]
// 이수 조건(합격 기준·응시 횟수·응시 조건·이수 인정 시청률)만 갱신. 문제는 건드리지 않음.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { lectureId } = await ctx.params;

  try {
    const { passScore, maxTries, examCond, passWatchPct } = await req.json();

    const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, academyId } });
    if (!lecture) return NextResponse.json({ error: '강의를 찾을 수 없습니다.' }, { status: 404 });

    // YouTube 강의는 시청률 추적 불가 → examCond를 'anytime'으로 강제 (UI 가드의 fallback)
    // examCond가 undefined인 PATCH(다른 필드만 갱신)는 그대로 통과시킴
    const safeExamCond = examCond !== undefined ? coerceExamCond(lecture, examCond) : undefined;
    if (examCond === 'after100' && isYouTubeLecture(lecture)) {
      console.warn(`[PATCH quizzes/${lectureId}] examCond coerced after100→anytime (YouTube lecture)`);
    }
    // create 경로(레코드 신규)도 동일하게 coerce
    const createExamCond = coerceExamCond(lecture, examCond ?? 'after100');

    // passWatchPct는 50~100 범위로 강제 (UI에서 강제하지만 서버에서도 1차 방어)
    const pctClamped =
      typeof passWatchPct === 'number' && Number.isFinite(passWatchPct)
        ? Math.max(50, Math.min(100, Math.round(passWatchPct)))
        : undefined;

    const quiz = await prisma.lectureQuiz.upsert({
      where: { lectureId },
      update: {
        ...(passScore !== undefined ? { passScore } : {}),
        ...(maxTries !== undefined ? { maxTries } : {}),
        ...(safeExamCond !== undefined ? { examCond: safeExamCond } : {}),
        ...(pctClamped !== undefined ? { passWatchPct: pctClamped } : {}),
      },
      create: {
        academyId,
        lectureId,
        passScore: passScore ?? 70,
        maxTries: maxTries ?? 3,
        examCond: createExamCond,
        passWatchPct: pctClamped ?? 100,
      },
    });

    return NextResponse.json({
      passScore: quiz.passScore,
      maxTries: quiz.maxTries,
      examCond: quiz.examCond,
      passWatchPct: quiz.passWatchPct,
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[PATCH /api/ingang/quizzes/[lectureId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
