import { prisma } from '@/lib/db/prisma';
import { DEFAULT_PERMISSIONS, type TeacherPermissions } from '@/lib/types/teacher';

/**
 * 강사 계정의 메뉴 권한을 DB(Teacher.permissions)에서 읽어 기본값과 병합한다.
 * 로그인 시 토큰에 임베드해 edge proxy가 DB 조회 없이 접근 제어하는 데 사용.
 *
 * ⚠️ 로그인 경로(서버액션 loginAction · POST /api/auth/login)가 모두 이 함수를 써야 한다.
 *    한쪽만 임베드하면 강사 토큰에 permissions가 없어 proxy가 모든 메뉴를 차단한다.
 *
 * @returns role이 'teacher'가 아니면 undefined
 */
export async function resolveTeacherPermissions(
  userId: string,
  role: string,
): Promise<TeacherPermissions | undefined> {
  if (role !== 'teacher') return undefined;
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { permissions: true },
  });
  return { ...DEFAULT_PERMISSIONS, ...((teacher?.permissions as Partial<TeacherPermissions>) ?? {}) };
}
