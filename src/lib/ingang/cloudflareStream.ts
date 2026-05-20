/**
 * Cloudflare Stream API 헬퍼.
 *
 * 영상 길이(durationSec)를 서버에서 권위 있게 얻기 위한 fetch.
 * 클라이언트가 보낸 값은 신뢰하지 않고, 영상 stamp 시 1회 호출 후 Lecture에 캐시한다.
 *
 * @see https://developers.cloudflare.com/api/operations/stream-videos-retrieve-video-details
 */

export type StreamVideoMeta = {
  duration: number; // 초 단위 (소수점 가능)
  readyToStream: boolean;
};

/**
 * Cloudflare Stream에서 video 메타데이터를 조회.
 * - 환경변수 CF_ACCOUNT_ID, CF_STREAM_API_TOKEN 필요
 * - 영상이 아직 인코딩 중이면 readyToStream=false 반환
 * - 실패 시 null 반환 (호출자가 graceful 처리)
 */
export async function fetchStreamVideoMeta(cfVideoId: string): Promise<StreamVideoMeta | null> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_STREAM_API_TOKEN;
  if (!accountId || !apiToken || !cfVideoId) return null;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${cfVideoId}`,
      { headers: { Authorization: `Bearer ${apiToken}` } },
    );
    if (!res.ok) {
      console.warn('[CF Stream meta] non-ok', cfVideoId, res.status);
      return null;
    }
    const data = await res.json();
    const r = data?.result;
    if (!r) return null;
    return {
      duration: typeof r.duration === 'number' ? r.duration : 0,
      readyToStream: Boolean(r.readyToStream),
    };
  } catch (err) {
    console.warn('[CF Stream meta] fetch fail', cfVideoId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * cfVideoId가 새로 설정되거나 변경되었을 때 durationSec를 조회해 반환.
 * - 인코딩 미완료 시 null 반환 (Lecture에 NULL로 저장 → 진도 추적은 backfill 후 활성화)
 */
export async function resolveDurationSec(cfVideoId: string | null | undefined): Promise<number | null> {
  if (!cfVideoId) return null;
  const meta = await fetchStreamVideoMeta(cfVideoId);
  if (!meta || !meta.readyToStream || meta.duration <= 0) return null;
  return Math.round(meta.duration);
}
