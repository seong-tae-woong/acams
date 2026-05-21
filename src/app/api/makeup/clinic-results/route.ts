import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { Prisma } from '@/generated/prisma/client';

interface ClinicCheck {
  itemId: string;
  checked: boolean;
}

interface ClinicCustomItem {
  id: string;
  label: string;
  checked: boolean;
}

function serialize(r: {
  id: string;
  makeupClassId: string;
  studentId: string;
  templateId: string;
  checks: Prisma.JsonValue;
  customItems: Prisma.JsonValue;
  hiddenItemIds: Prisma.JsonValue;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    makeupClassId: r.makeupClassId,
    studentId: r.studentId,
    templateId: r.templateId,
    checks: (r.checks as unknown as ClinicCheck[]) ?? [],
    customItems: (r.customItems as unknown as ClinicCustomItem[]) ?? [],
    hiddenItemIds: (r.hiddenItemIds as unknown as string[]) ?? [],
    authorId: r.authorId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// GET /api/makeup/clinic-results?makeupClassId=&studentId=(optional)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { searchParams } = new URL(req.url);
  const makeupClassId = searchParams.get('makeupClassId');
  const studentId = searchParams.get('studentId') || undefined;
  if (!makeupClassId) {
    return NextResponse.json({ error: 'makeupClassId 필수' }, { status: 400 });
  }

  try {
    const mc = await prisma.makeupClass.findFirst({
      where: { id: makeupClassId, academyId },
      select: { id: true },
    });
    if (!mc) return NextResponse.json({ error: '보강 권한 없음' }, { status: 403 });

    const rows = await prisma.makeupClinicResult.findMany({
      where: {
        academyId,
        makeupClassId,
        ...(studentId ? { studentId } : {}),
      },
    });
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    console.error('[GET /api/makeup/clinic-results]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/makeup/clinic-results — upsert
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { makeupClassId, studentId, templateId, checks, customItems, hiddenItemIds } = await req.json();
    if (!makeupClassId || !studentId || !templateId) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
    }
    if (!Array.isArray(checks)) {
      return NextResponse.json({ error: 'checks는 배열' }, { status: 400 });
    }
    const safeCustomItems: ClinicCustomItem[] = Array.isArray(customItems) ? customItems : [];
    const safeHiddenItemIds: string[] = Array.isArray(hiddenItemIds) ? hiddenItemIds : [];

    const mc = await prisma.makeupClass.findFirst({
      where: { id: makeupClassId, academyId },
      select: { id: true },
    });
    if (!mc) return NextResponse.json({ error: '보강 권한 없음' }, { status: 403 });

    const tmpl = await prisma.clinicTemplate.findFirst({ where: { id: templateId, academyId } });
    if (!tmpl) return NextResponse.json({ error: '양식 권한 없음' }, { status: 403 });

    const saved = await prisma.makeupClinicResult.upsert({
      where: {
        makeupClassId_studentId_templateId: { makeupClassId, studentId, templateId },
      },
      update: {
        checks: checks as unknown as Prisma.InputJsonValue,
        customItems: safeCustomItems as unknown as Prisma.InputJsonValue,
        hiddenItemIds: safeHiddenItemIds as unknown as Prisma.InputJsonValue,
        authorId: userId,
      },
      create: {
        academyId,
        makeupClassId,
        studentId,
        templateId,
        checks: checks as unknown as Prisma.InputJsonValue,
        customItems: safeCustomItems as unknown as Prisma.InputJsonValue,
        hiddenItemIds: safeHiddenItemIds as unknown as Prisma.InputJsonValue,
        authorId: userId,
      },
    });

    return NextResponse.json(serialize(saved));
  } catch (err) {
    console.error('[PUT /api/makeup/clinic-results]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
