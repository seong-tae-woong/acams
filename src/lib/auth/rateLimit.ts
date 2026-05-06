/**
 * 인메모리 슬라이딩 윈도우 Rate Limiter
 * - 서버리스(Vercel) 환경에서는 인스턴스별로 동작 (기본적인 DoS 방어)
 * - 분산 환경 프로덕션에서는 Upstash Redis 등으로 교체 권장
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * @returns true = 제한 초과 (차단), false = 허용
 */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= limit) return true;

  entry.count += 1;
  return false;
}

/** 남은 잠금 시간(초) 반환. 제한 중이 아니면 0 */
export function getRemainingSeconds(key: string): number {
  const entry = store.get(key);
  if (!entry) return 0;
  const remaining = Math.ceil((entry.resetAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/** 요청 IP 추출 (x-forwarded-for 우선, 없으면 'unknown') */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
