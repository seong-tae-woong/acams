import { NextRequest, NextResponse } from 'next/server';
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

// PATCH /api/lessons/clinic-templates/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const existing = await prisma.clinicTemplate.findFirst({ where: { id, academyId } });
    if (!existing) return NextResponse.json({ error: '양식을 찾을 수 없음' }, { status: 404 });

    const body = await req.json();
    const data: {
      name?: string;
      description?: string;
      items?: Prisma.InputJsonValue;
    } = {};
    if (typeof body.name === 'string') data.name = body.name;
    if (typeof body.description === 'string') data.description = body.description;
    if (Array.isArray(body.items)) data.items = body.items as Prisma.InputJsonValue;

    const updated = await prisma.clinicTemplate.update({ where: { id }, data });
    return NextResponse.json(serialize(updated));
  } catch (err) {
    console.error('[PATCH /api/lessons/clinic-templates/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/lessons/clinic-templates/[id] — soft delete (isActive: false)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const existing = await prisma.clinicTemplate.findFirst({ where: { id, academyId } });
    if (!existing) return NextResponse.json({ error: '양식을 찾을 수 없음' }, { status: 404 });

    await prisma.clinicTemplate.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/lessons/clinic-templates/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
