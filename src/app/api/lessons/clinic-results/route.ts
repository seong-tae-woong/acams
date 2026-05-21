import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { Prisma } from '@/generated/prisma/client';

interface ClinicCheck {
  itemId: string;
  checked: boolean;
}

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function serialize(r: {
  id: string;
  classId: string;
  studentId: string;
  templateId: string;
  sessionDate: Date;
  checks: Prisma.JsonValue;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    classId: r.classId,
    studentId: r.studentId,
    templateId: r.templateId,
    sessionDate: r.sessionDate.toISOString().slice(0, 10),
    checks: (r.checks as unknown as ClinicCheck[]) ?? [],
    authorId: r.authorId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /api/lessons/clinic-results?classId=&date=YYYY-MM-DD&studentId=(optional)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');
  const studentId = searchParams.get('studentId') || undefined;
  if (!classId || !date) {
    return NextResponse.json({ error: 'classId, date 필수' }, { status: 400 });
  }

  try {
    const rows = await prisma.clinicResult.findMany({
      where: {
        academyId,
        classId,
        sessionDate: toDateOnly(date),
        ...(studentId ? { studentId } : {}),
      },
    });
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    console.error('[GET /api/lessons/clinic-results]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/lessons/clinic-results — upsert
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId } = auth;

  try {
    const { classId, studentId, sessionDate, templateId, checks } = await req.json();
    if (!classId || !studentId || !sessionDate || !templateId) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
    }
    if (!Array.isArray(checks)) {
      return NextResponse.json({ error: 'checks는 배열' }, { status: 400 });
    }

    const cls = await prisma.class.findFirst({ where: { id: classId, academyId } });
    if (!cls) return NextResponse.json({ error: '반 권한 없음' }, { status: 403 });

    const tmpl = await prisma.clinicTemplate.findFirst({ where: { id: templateId, academyId } });
    if (!tmpl) return NextResponse.json({ error: '양식 권한 없음' }, { status: 403 });

    const saved = await prisma.clinicResult.upsert({
      where: {
        classId_studentId_sessionDate_templateId: {
          classId,
          studentId,
          sessionDate: toDateOnly(sessionDate),
          templateId,
        },
      },
      update: { checks: checks as unknown as Prisma.InputJsonValue, authorId: userId },
      create: {
        academyId,
        classId,
        studentId,
        templateId,
        sessionDate: toDateOnly(sessionDate),
        checks: checks as unknown as Prisma.InputJsonValue,
        authorId: userId,
      },
    });

    return NextResponse.json(serialize(saved));
  } catch (err) {
    console.error('[PUT /api/lessons/clinic-results]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
