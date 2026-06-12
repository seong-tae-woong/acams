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

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function serialize(
  r: {
    id: string;
    classId: string;
    studentId: string;
    templateId: string;
    sessionDate: Date;
    checks: Prisma.JsonValue;
    customItems: Prisma.JsonValue;
    hiddenItemIds: Prisma.JsonValue;
    authorId: string;
    checkedById: string | null;
    checkedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  nameMap?: Map<string, string>,
) {
  return {
    id: r.id,
    classId: r.classId,
    studentId: r.studentId,
    templateId: r.templateId,
    sessionDate: r.sessionDate.toISOString().slice(0, 10),
    checks: (r.checks as unknown as ClinicCheck[]) ?? [],
    customItems: (r.customItems as unknown as ClinicCustomItem[]) ?? [],
    hiddenItemIds: (r.hiddenItemIds as unknown as string[]) ?? [],
    authorId: r.authorId,
    authorName: nameMap?.get(r.authorId) ?? null,
    checkedById: r.checkedById ?? null,
    checkedByName: r.checkedById ? nameMap?.get(r.checkedById) ?? null : null,
    checkedAt: r.checkedAt ? r.checkedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// 완료(체크) 상태의 시그니처 — 체크된 항목 집합이 바뀌었는지 비교용
function checkedSignature(checks: unknown, customItems: unknown): string {
  const ids: string[] = [];
  if (Array.isArray(checks)) {
    for (const c of checks) {
      if (c && typeof c === 'object' && (c as ClinicCheck).checked) ids.push(`t:${(c as ClinicCheck).itemId}`);
    }
  }
  if (Array.isArray(customItems)) {
    for (const c of customItems) {
      if (c && typeof c === 'object' && (c as ClinicCustomItem).checked) ids.push(`c:${(c as ClinicCustomItem).id}`);
    }
  }
  return ids.sort().join('|');
}

// User.id → name 매핑 (작성자/체크자 이름 표시용)
async function buildNameMap(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  if (uniq.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
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
    const nameMap = await buildNameMap(rows.flatMap((r) => [r.authorId, r.checkedById]));
    return NextResponse.json(rows.map((r) => serialize(r, nameMap)));
  } catch (err) {
    console.error('[GET /api/lessons/clinic-results]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT /api/lessons/clinic-results — upsert
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { classId, studentId, sessionDate, templateId, checks, customItems, hiddenItemIds } = await req.json();
    if (!classId || !studentId || !sessionDate || !templateId) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
    }
    if (!Array.isArray(checks)) {
      return NextResponse.json({ error: 'checks는 배열' }, { status: 400 });
    }
    const safeCustomItems: ClinicCustomItem[] = Array.isArray(customItems) ? customItems : [];
    const safeHiddenItemIds: string[] = Array.isArray(hiddenItemIds) ? hiddenItemIds : [];

    const cls = await prisma.class.findFirst({ where: { id: classId, academyId } });
    if (!cls) return NextResponse.json({ error: '반 권한 없음' }, { status: 403 });

    const tmpl = await prisma.clinicTemplate.findFirst({ where: { id: templateId, academyId } });
    if (!tmpl) return NextResponse.json({ error: '양식 권한 없음' }, { status: 403 });

    const whereKey = {
      classId_studentId_sessionDate_templateId: {
        classId,
        studentId,
        sessionDate: toDateOnly(sessionDate),
        templateId,
      },
    };

    // 기존 행을 먼저 조회해 "체크 상태가 바뀌었는지"와 "신규 생성인지"를 판단
    const existing = await prisma.clinicResult.findUnique({ where: whereKey });
    const incomingSig = checkedSignature(checks, safeCustomItems);
    const checkChanged = existing
      ? incomingSig !== checkedSignature(existing.checks, existing.customItems)
      : incomingSig !== '';

    const saved = await prisma.clinicResult.upsert({
      where: whereKey,
      update: {
        checks: checks as unknown as Prisma.InputJsonValue,
        customItems: safeCustomItems as unknown as Prisma.InputJsonValue,
        hiddenItemIds: safeHiddenItemIds as unknown as Prisma.InputJsonValue,
        // authorId(작성자)는 최초 생성자로 고정 — 갱신 시 덮어쓰지 않음
        ...(checkChanged ? { checkedById: userId, checkedAt: new Date() } : {}),
      },
      create: {
        academyId,
        classId,
        studentId,
        templateId,
        sessionDate: toDateOnly(sessionDate),
        checks: checks as unknown as Prisma.InputJsonValue,
        customItems: safeCustomItems as unknown as Prisma.InputJsonValue,
        hiddenItemIds: safeHiddenItemIds as unknown as Prisma.InputJsonValue,
        authorId: userId,
        ...(checkChanged ? { checkedById: userId, checkedAt: new Date() } : {}),
      },
    });

    const nameMap = await buildNameMap([saved.authorId, saved.checkedById]);
    return NextResponse.json(serialize(saved, nameMap));
  } catch (err) {
    console.error('[PUT /api/lessons/clinic-results]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
