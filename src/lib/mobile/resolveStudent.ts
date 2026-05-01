import { prisma } from '@/lib/db/prisma';

/**
 * 역할에 따라 studentId를 결정한다.
 * parent의 경우 requestedStudentId가 실제 자녀인지 검증 후 반환하고,
 * 없거나 유효하지 않으면 첫 번째 자녀를 반환한다.
 */
export async function resolveStudentId(params: {
  userId: string;
  role: string;
  academyId: string;
  requestedStudentId?: string | null;
}): Promise<string | null> {
  const { userId, role, academyId, requestedStudentId } = params;

  if (role === 'student') {
    const s = await prisma.student.findFirst({
      where: { userId, academyId },
      select: { id: true },
    });
    return s?.id ?? null;
  }

  if (role === 'parent') {
    const parent = await prisma.parent.findFirst({
      where: { userId },
      include: {
        children: {
          include: { student: { select: { id: true } } },
        },
      },
    });
    if (!parent || parent.children.length === 0) return null;

    if (requestedStudentId) {
      const isValid = parent.children.some((c) => c.student.id === requestedStudentId);
      if (isValid) return requestedStudentId;
    }

    return parent.children[0].student.id;
  }

  return null;
}

/**
 * studentId에 해당하는 활성 수강 반 목록을 반환한다.
 */
export async function resolveClassIds(studentId: string): Promise<string[]> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { studentId, isActive: true },
    select: { classId: true },
  });
  return enrollments.map((e) => e.classId);
}
