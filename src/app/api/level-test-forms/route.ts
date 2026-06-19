import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { normalizeFormTypesAndMap } from '@/lib/levelTest/formValidation';
import type { LevelTestType, QuestionMapEntry } from '@/lib/levelTest/types';

// GET /api/level-test-forms?grade=2&subject=영어 — 학원의 활성 양식 목록
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const gradeParam = searchParams.get('grade');
  const subject = searchParams.get('subject');
  const grade = gradeParam ? Number(gradeParam) : undefined;

  try {
    const forms = await prisma.levelTestForm.findMany({
      where: {
        academyId,
        isActive: true,
        ...(grade !== undefined && Number.isFinite(grade) ? { grade } : {}),
        ...(subject ? { subject } : {}),
      },
      orderBy: [{ grade: 'asc' }, { createdAt: 'desc' }],
    });

    const result = forms.map((f) => {
      const types = (f.types as unknown as LevelTestType[]) ?? [];
      const questionMap = (f.questionMap as unknown as QuestionMapEntry[]) ?? [];
      return {
        id: f.id,
        grade: f.grade,
        subject: f.subject,
        title: f.title,
        pdfUrl: f.pdfUrl,
        types,
        questionMap,
        totalQuestions: questionMap.length,
        showAverage: f.showAverage,
        createdAt: f.createdAt.toISOString(),
      };
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/level-test-forms]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/level-test-forms — 양식 생성
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { grade, subject, title, pdfUrl, showAverage } = body;

    if (!Number.isInteger(grade)) {
      return NextResponse.json({ error: '학년은 필수입니다.' }, { status: 400 });
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: '양식 이름은 필수입니다.' }, { status: 400 });
    }

    const v = normalizeFormTypesAndMap(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const form = await prisma.levelTestForm.create({
      data: {
        academyId,
        grade,
        subject: typeof subject === 'string' ? subject : '',
        title: title.trim(),
        pdfUrl: typeof pdfUrl === 'string' && pdfUrl ? pdfUrl : null,
        types: v.types as unknown as object,
        questionMap: v.questionMap as unknown as object,
        showAverage: showAverage !== false,
      },
    });

    return NextResponse.json({ id: form.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/level-test-forms]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
