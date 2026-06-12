import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// DateTime → 'YYYY-MM-DD' (KST 기준)
function toDateStr(d: Date): string {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Seoul' }).format(d);
}

function mapEvent(e: { id: string; classId: string; date: Date; startTime: string; endTime: string; teacherId: string | null }) {
  return {
    id: e.id,
    classId: e.classId,
    date: toDateStr(e.date),
    startTime: e.startTime,
    endTime: e.endTime,
    teacherId: e.teacherId,
  };
}

// PATCH /api/class-events/[id] — body: { date?, startTime?, endTime?, teacherId? }
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const existing = await prisma.classEvent.findUnique({ where: { id }, select: { academyId: true } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { date, startTime, endTime, teacherId } = await req.json();

    // 강사 지정 시 같은 학원 소속인지 검증 (null = 반 대표 강사 사용)
    if (teacherId) {
      const t = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { academyId: true } });
      if (!t || t.academyId !== academyId) {
        return NextResponse.json({ error: '강사를 찾을 수 없습니다.' }, { status: 404 });
      }
    }

    const updated = await prisma.classEvent.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(teacherId !== undefined && { teacherId: teacherId ?? null }),
      },
    });
    return NextResponse.json(mapEvent(updated));
  } catch (err) {
    console.error('[PATCH /api/class-events/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/class-events/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const existing = await prisma.classEvent.findUnique({ where: { id }, select: { academyId: true } });
    if (!existing || existing.academyId !== academyId) {
      return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.classEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/class-events/[id]]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
