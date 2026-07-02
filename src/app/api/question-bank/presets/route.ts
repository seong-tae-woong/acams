import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Prisma } from '@/generated/prisma/client';
import { parseTestSpec, parseLayout } from '@/lib/questionBank/spec';

// GET /api/question-bank/presets — 학원 출제 양식(프리셋) 목록
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const presets = await prisma.testPreset.findMany({
      where: { academyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, spec: true, layout: true, createdAt: true },
    });
    return NextResponse.json({ presets });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/question-bank/presets]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/question-bank/presets — 프리셋 저장 (name + spec 필드(플랫) + layout)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: '양식 이름을 입력해주세요.' }, { status: 400 });
    }
    if (name.length > 60) {
      return NextResponse.json({ error: '양식 이름이 너무 깁니다(최대 60자).' }, { status: 400 });
    }
    const parsed = parseTestSpec(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const layout = parseLayout(body.layout);

    const preset = await prisma.testPreset.create({
      data: {
        academyId,
        createdBy: userId,
        name,
        spec: parsed.spec as unknown as Prisma.InputJsonValue,
        layout,
      },
      select: { id: true, name: true, spec: true, layout: true, createdAt: true },
    });
    return NextResponse.json({ preset }, { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/question-bank/presets]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
