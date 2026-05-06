import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const MAKEUP_INCLUDE = {
  originalClass: { select: { name: true } },
  teacher: { select: { name: true } },
  targets: { select: { studentId: true } },
} as const;

function mapMakeup(m: {
  id: string; originalClassId: string; originalDate: Date;
  makeupDate: Date; makeupTime: string; teacherId: string;
  reason: string; attendanceChecked: boolean;
  originalClass: { name: string };
  teacher: { name: string };
  targets: { studentId: string }[];
}) {
  return {
    id: m.id,
    originalClassId: m.originalClassId,
    originalClassName: m.originalClass.name,
    originalDate: m.originalDate.toISOString().slice(0, 10),
    makeupDate: m.makeupDate.toISOString().slice(0, 10),
    makeupTime: m.makeupTime,
    teacherId: m.teacherId,
    teacherName: m.teacher.name,
    targetStudents: m.targets.map((t) => t.studentId),
    reason: m.reason,
    attendanceChecked: m.attendanceChecked,
  };
}

// GET /api/makeup?classId=&month=
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const month = searchParams.get('month');

  try {
    const makeups = await prisma.makeupClass.findMany({
      where: {
        academyId,
        ...(classId ? { originalClassId: classId } : {}),
        ...(month
          ? {
              makeupDate: {
                gte: new Date(`${month}-01`),
                lt: new Date(
                  month.slice(0, 4) + '-' +
                  String(parseInt(month.slice(5, 7)) + 1).padStart(2, '0') + '-01'
                ),
              },
            }
          : {}),
      },
      include: MAKEUP_INCLUDE,
      orderBy: { makeupDate: 'desc' },
    });

    return NextResponse.json(makeups.map(mapMakeup));
  } catch (err) {
    console.error('[GET /api/makeup]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/makeup
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { originalClassId, originalDate, makeupDate, makeupTime, teacherId, reason, targetStudents } =
      await req.json();

    if (!originalClassId || !originalDate || !makeupDate || !teacherId) {
      return NextResponse.json({ error: '원래 반, 날짜, 보강일, 강사는 필수입니다.' }, { status: 400 });
    }

    const makeup = await prisma.$transaction(async (tx) => {
      const m = await tx.makeupClass.create({
        data: {
          academyId,
          originalClassId,
          originalDate: new Date(originalDate),
          makeupDate: new Date(makeupDate),
          makeupTime: makeupTime ?? '',
          teacherId,
          reason: reason ?? '',
          attendanceChecked: false,
        },
      });

      if (Array.isArray(targetStudents) && targetStudents.length > 0) {
        await tx.makeupClassTarget.createMany({
          data: targetStudents.map((studentId: string) => ({
            makeupClassId: m.id,
            studentId,
          })),
          skipDuplicates: true,
        });
      }

      return m.id;
    });

    const created = await prisma.makeupClass.findUnique({
      where: { id: makeup },
      include: MAKEUP_INCLUDE,
    });

    return NextResponse.json(mapMakeup(created!), { status: 201 });
  } catch (err) {
    console.error('[POST /api/makeup]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
