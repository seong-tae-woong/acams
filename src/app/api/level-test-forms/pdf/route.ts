import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/log/logServerError';
import { put } from '@vercel/blob';
import { requireAuth } from '@/lib/auth/requireAuth';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB (시험지 PDF)

function isStaff(role: string) {
  return role === 'director' || role === 'teacher' || role === 'super_admin';
}

// GET /api/level-test-forms/pdf?url=<encoded-blob-url>
// private Blob Store의 시험지 PDF를 교직원에게만 스트리밍하는 프록시.
// 시험지는 외부에 노출되면 안 되므로 (1) 교직원 인증 (2) 본인 학원 경로 검증을 모두 거친다.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (!isStaff(role)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const blobUrl = req.nextUrl.searchParams.get('url');
  if (!blobUrl) return NextResponse.json({ error: 'url이 필요합니다.' }, { status: 400 });

  // SSRF 방지: vercel blob 호스트만 허용 (hostname 정확 검증)
  let parsed: URL;
  try {
    parsed = new URL(blobUrl);
  } catch {
    return NextResponse.json({ error: '잘못된 URL입니다.' }, { status: 400 });
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    return NextResponse.json({ error: '잘못된 URL입니다.' }, { status: 400 });
  }
  // 테넌트 격리: 본인 학원 경로(level-tests/<academyId>/)만 허용
  if (!parsed.pathname.startsWith(`/level-tests/${academyId}/`)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const res = await fetch(blobUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return NextResponse.json({ error: 'PDF를 찾을 수 없습니다.' }, { status: res.status });
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        // inline → 브라우저 새 탭에서 바로 보고 인쇄(Ctrl+P)
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent('시험지.pdf')}`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    await logServerError(req, err);
    console.error('[GET /api/level-test-forms/pdf]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'PDF를 불러오지 못했습니다.' }, { status: 500 });
  }
}

// POST /api/level-test-forms/pdf — 레벨 테스트 시험지 PDF 업로드 → { url }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (!isStaff(role)) {
    return NextResponse.json({ error: '강사 이상 권한이 필요합니다.' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF 파일만 업로드할 수 있습니다.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    // 스토어가 private 전용이므로 private로 업로드하고, 인증된 프록시(GET)로 서빙한다.
    const blob = await put(
      `level-tests/${academyId}/${Date.now()}.pdf`,
      file,
      { access: 'private', token },
    );
    // 클라이언트는 이 프록시 URL을 그대로 pdfUrl로 저장·출력에 사용
    return NextResponse.json({ url: `/api/level-test-forms/pdf?url=${encodeURIComponent(blob.url)}` });
  } catch (err) {
    await logServerError(req, err);
    console.error('[POST /api/level-test-forms/pdf]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '업로드에 실패했습니다.' }, { status: 500 });
  }
}
