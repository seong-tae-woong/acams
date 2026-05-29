/**
 * GET /api/ingang/certificates/[id]/pdf
 *
 * 이수증 PDF 즉석 생성 + 스트림 응답.
 * - Certificate snapshot 필드 기반 (발급 시점 정보 고정)
 * - 한글 폰트(NotoSansKR Korean subset) 등록
 * - cancelledAt != null이면 워터마크 + 410 응답
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { renderToBuffer, Document, Page, Text, View, Font, StyleSheet } from '@react-pdf/renderer';
import { createElement } from 'react';
import path from 'path';

export const runtime = 'nodejs';

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  try {
    // node_modules의 @fontsource/noto-sans-kr 한국어 subset woff 파일을 등록
    const fontPath = path.join(
      process.cwd(),
      'node_modules',
      '@fontsource',
      'noto-sans-kr',
      'files',
      'noto-sans-kr-korean-400-normal.woff',
    );
    Font.register({
      family: 'NotoSansKR',
      src: fontPath,
    });
    fontRegistered = true;
  } catch (err) {
    console.error('[pdf] font registration failed:', err instanceof Error ? err.message : String(err));
    // 폰트 등록 실패해도 PDF 생성은 시도 (한글 깨질 수 있음)
  }
}

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: 'NotoSansKR',
    backgroundColor: '#ffffff',
  },
  borderFrame: {
    borderWidth: 3,
    borderColor: '#5B4FBE',
    borderStyle: 'solid',
    padding: 40,
    height: '100%',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
  },
  academyName: {
    fontSize: 14,
    color: '#534AB7',
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: 700,
    color: '#1e1b2e',
    letterSpacing: 8,
  },
  divider: {
    borderBottomWidth: 2,
    borderBottomColor: '#a78bfa',
    marginVertical: 20,
    width: '40%',
    alignSelf: 'center',
  },
  body: {
    marginVertical: 30,
    textAlign: 'center',
  },
  studentLine: {
    fontSize: 20,
    marginBottom: 24,
  },
  studentName: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1e1b2e',
    marginBottom: 32,
  },
  seriesLine: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 8,
  },
  seriesTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#534AB7',
    marginBottom: 32,
  },
  statementLine: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 1.8,
    marginVertical: 24,
  },
  scoreRow: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 12,
  },
  footer: {
    marginTop: 60,
    textAlign: 'center',
  },
  dateLine: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 24,
  },
  issuerName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1e1b2e',
  },
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    fontSize: 80,
    color: 'rgba(248, 113, 113, 0.3)',
    transform: 'rotate(-25deg)',
  },
});

function formatKoreanDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}년 ${mm}월 ${dd}일`;
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;

  // director / teacher / super_admin만. 학생/학부모는 본인 cert만 보게 하려면 별도 mobile 라우트 필요.
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;

  try {
    const cert = await prisma.certificate.findFirst({
      where: { id, academyId },
      select: {
        id: true,
        issuedAt: true,
        cancelledAt: true,
        academyNameSnapshot: true,
        directorNameSnapshot: true,
        studentNameSnapshot: true,
        seriesTitleSnapshot: true,
        scoreSnapshot: true,
      },
    });

    if (!cert) {
      return NextResponse.json({ error: '이수증을 찾을 수 없습니다.' }, { status: 404 });
    }

    ensureFontRegistered();

    const cancelled = cert.cancelledAt != null;

    const doc = createElement(
      Document,
      null,
      createElement(
        Page,
        { size: 'A4', style: styles.page },
        createElement(
          View,
          { style: styles.borderFrame },
          createElement(
            View,
            { style: styles.header },
            createElement(Text, { style: styles.academyName }, cert.academyNameSnapshot),
            createElement(Text, { style: styles.title }, '이수증'),
          ),
          createElement(View, { style: styles.divider }),
          createElement(
            View,
            { style: styles.body },
            createElement(Text, { style: styles.studentLine }, '성  명'),
            createElement(Text, { style: styles.studentName }, cert.studentNameSnapshot),
            createElement(Text, { style: styles.seriesLine }, '이수 과정'),
            createElement(Text, { style: styles.seriesTitle }, cert.seriesTitleSnapshot),
            createElement(
              Text,
              { style: styles.statementLine },
              '위 학생은 본 과정을 성실히 이수하였음을 증명합니다.',
            ),
            cert.scoreSnapshot != null
              ? createElement(
                  Text,
                  { style: styles.scoreRow },
                  `평균 점수: ${cert.scoreSnapshot}점`,
                )
              : null,
          ),
          createElement(
            View,
            { style: styles.footer },
            createElement(Text, { style: styles.dateLine }, formatKoreanDate(cert.issuedAt)),
            createElement(Text, { style: styles.academyName }, cert.academyNameSnapshot),
            createElement(Text, { style: styles.issuerName }, `대표  ${cert.directorNameSnapshot}  (인)`),
          ),
          cancelled
            ? createElement(Text, { style: styles.watermark }, 'CANCELLED')
            : null,
        ),
      ),
    );

    const pdfBuffer = await renderToBuffer(doc);
    // Buffer → Blob (Next 16 BodyInit 호환)
    const body = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });

    const filename = `certificate-${cert.id}.pdf`;
    return new NextResponse(body, {
      status: cancelled ? 410 : 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    console.error('[GET /api/ingang/certificates/[id]/pdf]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'PDF 생성 실패' }, { status: 500 });
  }
}
