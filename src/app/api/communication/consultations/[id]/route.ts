import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

// PATCH /api/communication/consultations/[id]
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const { date, time, duration, type, topic, content, followUp } = body;

    const updateData: Record<string, unknown> = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (time !== undefined) updateData.time = time;
    if (duration !== undefined) updateData.duration = duration;
    if (type !== undefined) updateData.type = type;
    if (topic !== undefined) updateData.topic = topic;
    if (content !== undefined) updateData.content = content;
    if (followUp !== undefined) updateData.followUp = followUp;

    const updated = await prisma.consultationRecord.update({
      where: { id, academyId },
      data: updateData,
      include: {
        student: {
          select: {
            name: true,
            parentLinks: { include: { parent: { select: { name: true } } }, take: 1 },
          },
        },
        teacher: { select: { name: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      studentId: updated.studentId,
      studentName: updated.student?.name ?? '',
      parentName: updated.student?.parentLinks?.[0]?.parent?.name ?? '',
      teacherId: updated.teacherId,
      teacherName: updated.teacher?.name ?? '',
      date: updated.date.toISOString().slice(0, 10),
      time: updated.time,
      duration: updated.duration,
      type: updated.type,
      topic: updated.topic,
      content: updated.content,
      followUp: updated.followUp,
    });
  } catch (err) {
    console.error('[PATCH /api/communication/consultations/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/communication/consultations/[id]
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId } = auth;

  const { id } = await ctx.params;

  try {
    await prisma.consultationRecord.delete({ where: { id, academyId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/communication/consultations/[id]]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
