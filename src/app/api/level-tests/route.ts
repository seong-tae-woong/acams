import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { LevelTestType, QuestionMapEntry } from '@/lib/levelTest/types';

// POST /api/level-tests — 레벨 테스트 실시 (양식 → Exam 스냅샷 + 빈 GradeRecord)
//   body: { studentId, formId, date? }
//   - classId = null (반 배정 전), levelTestFormId 설정
//   - types/questionMap을 실시 시점 스냅샷으로 복사 (양식 수정이 과거 시험에 영향 없도록)
//   - 반이 없으므로 sendPushToClass 호출하지 않음 (F1)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { studentId, formId, date } = await req.json();
    if (!studentId || !formId) {
      return NextResponse.json({ error: '학생과 양식은 필수입니다.' }, { status: 400 });
    }

    const [student, form] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, academyId }, select: { id: true } }),
      prisma.levelTestForm.findFirst({ where: { id: formId, academyId, isActive: true } }),
    ]);
    if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    if (!form) return NextResponse.json({ error: '양식을 찾을 수 없습니다.' }, { status: 404 });

    const types = (form.types as unknown as LevelTestType[]) ?? [];
    const questionMap = (form.questionMap as unknown as QuestionMapEntry[]) ?? [];
    if (questionMap.length === 0 || types.length === 0) {
      return NextResponse.json({ error: '양식의 유형·문항 구성이 비어 있습니다.' }, { status: 400 });
    }

    const exam = await prisma.exam.create({
      data: {
        academyId,
        classId: null,
        levelTestFormId: form.id,
        name: form.title,
        subject: form.subject,
        date: date ? new Date(date) : new Date(),
        totalScore: 100,
        totalQuestions: questionMap.length,
        types: types as unknown as object,
        questionMap: questionMap as unknown as object,
        gradeRecords: {
          create: { academyId, studentId }, // 빈 채점 (wrongNumbers=[], sectionScores=null)
        },
      },
      select: { id: true, gradeRecords: { select: { id: true } } },
    });

    return NextResponse.json(
      { examId: exam.id, gradeRecordId: exam.gradeRecords[0]?.id ?? null },
      { status: 201 },
    );
  } catch (err) {
    console.error('[POST /api/level-tests]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
