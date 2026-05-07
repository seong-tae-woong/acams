import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function formatSchedule(schedules: { dayOfWeek: number; startTime: string; endTime: string }[]) {
  if (!schedules.length) return '';
  const days = schedules.map((s) => DAY_LABEL[s.dayOfWeek]).join('·');
  const { startTime, endTime } = schedules[0];
  return `${days} ${startTime}~${endTime}`;
}

// GET /api/academy/[slug]/classes/[classId]  — 공개 (proxy PUBLIC_PATHS)
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; classId: string }> },
) {
  const { slug, classId } = await ctx.params;

  try {
    const academy = await prisma.academy.findUnique({ where: { slug } });
    if (!academy || !academy.isActive || !academy.profileEnabled) {
      return NextResponse.json({ error: '학원을 찾을 수 없습니다.' }, { status: 404 });
    }

    const cls = await prisma.class.findFirst({
      where: { id: classId, academyId: academy.id, isActive: true },
      include: {
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        textbooks: { orderBy: { createdAt: 'asc' } },
        curriculumRows: { orderBy: [{ unitType: 'asc' }, { startWeek: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!cls) {
      return NextResponse.json({ error: '수업을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      id: cls.id,
      name: cls.name,
      subject: cls.subject,
      grade: cls.level ?? '',
      fee: academy.showFees ? cls.fee : null,
      color: cls.color,
      schedule: formatSchedule(cls.schedules),
      description: cls.description ?? '',
      curriculumPalette: (cls.curriculumPalette as 'red' | 'orange' | 'green' | 'custom') ?? 'green',
      curriculum: cls.curriculumRows.map((r) => ({
        id: r.id,
        unitType: r.unitType,
        startWeek: r.startWeek,
        endWeek: r.endWeek,
        topic: r.topic,
        detail: r.detail,
        color: r.color,
        done: r.done,
      })),
      textbooks: cls.textbooks.map((tb) => ({
        id: tb.id,
        name: tb.name,
        publisher: tb.publisher,
        unit: tb.unit,
        totalUnits: tb.totalUnits,
        currentUnit: tb.currentUnit,
        price: academy.showFees ? tb.price : null,
      })),
    });
  } catch (err) {
    console.error('[GET /api/academy/[slug]/classes/[classId]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
