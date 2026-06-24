/**
 * POST /api/ingang/certificates
 *
 * 일괄 이수증 발급 — LectureSeriesCompletion 기반.
 *
 * Body: { seriesCompletionIds: string[] }
 *
 * 동작:
 * 1. 입력의 LSC들이 모두 이 academy 소속인지 검증
 * 2. 이미 발급된 (cancelledAt=null Certificate 있음) LSC는 skip
 * 3. 학원/원장/학생/시리즈 정보 snapshot 채워서 Certificate 일괄 생성
 *
 * 응답: { issuedCount, skippedCount, certificates }
 */
import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, userId, role } = auth;

  if (role !== 'director' && role !== 'super_admin') {
    return NextResponse.json({ error: '원장 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body?.seriesCompletionIds)
      ? body.seriesCompletionIds
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: '발급 대상이 비어 있습니다.' }, { status: 400 });
    }

    // academy + director 정보 + 발급 처리자 정보 lookup
    const [academy, issuer] = await Promise.all([
      prisma.academy.findUnique({
        where: { id: academyId },
        select: { name: true, directorName: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
    ]);

    if (!academy || !issuer) {
      return NextResponse.json({ error: '학원 또는 발급자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    const directorName = academy.directorName ?? issuer.name;

    // LSC 일괄 조회 (academy 격리 + student/series 정보 포함)
    const completions = await prisma.lectureSeriesCompletion.findMany({
      where: { id: { in: ids }, academyId },
      include: {
        student: { select: { name: true } },
        series: { select: { title: true } },
        certificate: { select: { id: true, cancelledAt: true } },
      },
    });

    if (completions.length !== ids.length) {
      return NextResponse.json({ error: '학원 외부 또는 존재하지 않는 LSC가 포함돼 있습니다.' }, { status: 403 });
    }

    const issued: Array<{ certificateId: string; seriesCompletionId: string }> = [];
    const skipped: Array<{ seriesCompletionId: string; reason: string }> = [];

    for (const lsc of completions) {
      // 활성 Certificate(cancelledAt=null) 이미 있으면 skip
      if (lsc.certificate && lsc.certificate.cancelledAt == null) {
        skipped.push({ seriesCompletionId: lsc.id, reason: '이미 발급됨' });
        continue;
      }

      try {
        const cert = await prisma.certificate.create({
          data: {
            academyId,
            seriesCompletionId: lsc.id,
            issuedById: userId,
            academyNameSnapshot: academy.name,
            directorNameSnapshot: directorName,
            studentNameSnapshot: lsc.student.name,
            seriesTitleSnapshot: lsc.series.title,
            scoreSnapshot: lsc.scoreSnapshot,
          },
          select: { id: true },
        });
        issued.push({ certificateId: cert.id, seriesCompletionId: lsc.id });
      } catch (err) {
        // Unique 제약 위반 또는 동시 발급 race
        console.error(`[certificates] create failed for LSC ${lsc.id}:`, err instanceof Error ? err.message : String(err));
        skipped.push({ seriesCompletionId: lsc.id, reason: '발급 충돌(이미 발급되었을 수 있음)' });
      }
    }

    return NextResponse.json({
      issuedCount: issued.length,
      skippedCount: skipped.length,
      issued,
      skipped,
    }, { status: 201 });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/ingang/certificates]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
