import { NextRequest, NextResponse } from 'next/server';

// POST /api/lectures/upload-url
// Cloudflare Stream direct creator upload URL 발급
export async function POST(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id');
  if (!academyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken  = process.env.CF_STREAM_API_TOKEN;

  if (!accountId || !apiToken) {
    return NextResponse.json(
      { error: 'Cloudflare Stream 환경변수(CF_ACCOUNT_ID, CF_STREAM_API_TOKEN)가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 7200,   // 최대 2시간
          requireSignedURLs: false,
          meta: { academyId },
        }),
      },
    );

    const data = await res.json();

    if (!res.ok || !data.result) {
      console.error('[CF Stream] direct_upload 오류:', data);
      return NextResponse.json(
        { error: 'Cloudflare 업로드 URL 생성에 실패했습니다.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      uploadURL: data.result.uploadURL,
      uid: data.result.uid,
    });
  } catch (err) {
    console.error('[POST /api/lectures/upload-url]', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
