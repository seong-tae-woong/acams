import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/db/prisma';

const MAX_SIZE = 1 * 1024 * 1024; // 1MB 서버 측 안전 제한

function toProxyUrl(blobUrl: string): string {
  if (!blobUrl || !blobUrl.includes('blob.vercel-storage.com')) return blobUrl;
  return `/api/gallery-proxy?url=${encodeURIComponent(blobUrl)}`;
}

// POST /api/settings/gallery — 학원 사진 업로드
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const role = req.headers.get('x-user-role');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'director') return NextResponse.json({ error: '원장만 업로드할 수 있습니다.' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const index = parseInt((formData.get('index') as string) ?? '');

  if (!file || isNaN(index) || index < 0 || index > 5) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 1MB 이하여야 합니다.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '이미지 파일만 업로드할 수 있습니다.' }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { galleryImages: true },
    });
    const images = [...((academy?.galleryImages as string[]) ?? [])];
    while (images.length <= index) images.push('');

    // 기존 Blob 삭제
    if (images[index]?.includes('blob.vercel-storage.com')) {
      try { await del(images[index], { token }); } catch { /* 삭제 실패 무시 */ }
    }

    // 새 이미지 업로드
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const blob = await put(
      `galleries/${academyId}/${index}-${Date.now()}.${ext}`,
      file,
      { access: 'private', token },
    );

    images[index] = blob.url;
    await prisma.academy.update({
      where: { id: academyId },
      data: { galleryImages: images },
    });

    return NextResponse.json({ url: toProxyUrl(blob.url) });
  } catch (err) {
    console.error('[POST /api/settings/gallery]', err);
    return NextResponse.json({ error: '업로드에 실패했습니다.' }, { status: 500 });
  }
}

// DELETE /api/settings/gallery?index=N — 학원 사진 삭제
export async function DELETE(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  const role = req.headers.get('x-user-role');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'director') return NextResponse.json({ error: '원장만 삭제할 수 있습니다.' }, { status: 403 });

  const index = parseInt(new URL(req.url).searchParams.get('index') ?? '');
  if (isNaN(index) || index < 0 || index > 5) {
    return NextResponse.json({ error: '잘못된 인덱스입니다.' }, { status: 400 });
  }

  try {
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { galleryImages: true },
    });
    const images = [...((academy?.galleryImages as string[]) ?? [])];

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (images[index]?.includes('blob.vercel-storage.com')) {
      try { await del(images[index], token ? { token } : {}); } catch { /* 삭제 실패 무시 */ }
    }

    images[index] = '';
    await prisma.academy.update({
      where: { id: academyId },
      data: { galleryImages: images },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/settings/gallery]', err);
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
