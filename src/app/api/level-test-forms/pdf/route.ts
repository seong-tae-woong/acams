import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAuth } from '@/lib/auth/requireAuth';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB (시험지 PDF)

// POST /api/level-test-forms/pdf — 레벨 테스트 시험지 PDF 업로드 → { url }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { academyId, role } = auth;
  if (role !== 'director' && role !== 'teacher' && role !== 'super_admin') {
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
    // 출력·인쇄를 위해 직접 접근 가능한 public URL (URL에 무작위 접미사 포함)
    const blob = await put(
      `level-tests/${academyId}/${Date.now()}.pdf`,
      file,
      { access: 'public', token },
    );
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('[POST /api/level-test-forms/pdf]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: '업로드에 실패했습니다.' }, { status: 500 });
  }
}
