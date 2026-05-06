import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getRemainingSeconds, getClientIp } from '@/lib/auth/rateLimit';

// GET /api/gallery-proxy?url=<encoded-blob-url>
// Private Blob Store의 이미지를 공개적으로 서빙하는 프록시 (인증 불필요)
export async function GET(req: NextRequest) {
  // IP 기반 rate limit — 대역폭 남용 방지
  const ip = getClientIp(req);
  if (isRateLimited(`gallery:${ip}`, 100, 60 * 1000)) {
    const secs = getRemainingSeconds(`gallery:${ip}`);
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(secs) },
    });
  }

  const blobUrl = req.nextUrl.searchParams.get('url');

  if (!blobUrl) {
    return new NextResponse('Bad Request', { status: 400 });
  }
  // SSRF 방지: URL 파싱 후 hostname을 정확히 검증 (includes()는 우회 가능)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(blobUrl);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
  if (
    parsedUrl.protocol !== 'https:' ||
    !parsedUrl.hostname.endsWith('.blob.vercel-storage.com')
  ) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return new NextResponse('Token not configured', { status: 500 });
  }

  try {
    const res = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return new NextResponse('Image not found', { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Failed to fetch image', { status: 500 });
  }
}
