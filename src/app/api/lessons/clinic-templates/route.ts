import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { Prisma } from '@/generated/prisma/client';

interface ClinicTemplateItem {
  id: string;
  label: string;
  order: number;
}

function serialize(t: {
  id: string;
  name: string;
  description: string;
  items: Prisma.JsonValue;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    items: (t.items as unknown as ClinicTemplateItem[]) ?? [],
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// GET /api/lessons/clinic-templates — 활성 양식 목록
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  try {
    const rows = await prisma.clinicTemplate.findMany({
      where: { academyId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/lessons/clinic-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/lessons/clinic-templates — 양식 생성
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { name, description, items } = await req.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '양식 이름 필수' }, { status: 400 });
    }
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items는 배열' }, { status: 400 });
    }

    const created = await prisma.clinicTemplate.create({
      data: {
        academyId,
        name,
        description: description ?? '',
        items: items as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(serialize(created), { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/lessons/clinic-templates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
