function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buf;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'no-key' | 'denied' | 'dismissed' | 'server-error' | 'unknown' };

// 권한 요청 → SW 구독 → 서버 등록까지 한 번에. 사용자 제스처 직후 호출되어야 함 (iOS 권한 다이얼로그 요건).
export async function enablePushSubscription(): Promise<SubscribeResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, reason: 'no-key' };

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'denied') return { ok: false, reason: 'denied' };
    if (perm !== 'granted') return { ok: false, reason: 'dismissed' };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });
    }
    const json = sub.toJSON();
    const res = await fetch('/api/mobile/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
    });
    if (!res.ok) {
      await sub.unsubscribe().catch(() => {});
      return { ok: false, reason: 'server-error' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

export async function disablePushSubscription(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(`/api/mobile/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
        method: 'DELETE',
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch { /* swallow */ }
}

// 권한이 이미 granted인데 구독이 없으면 조용히 복구 (기기 교체/재설치 케이스). 가시 UI 변화 없음.
export async function silentlyResubscribeIfPossible(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return true; // 이미 구독 있음
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
    const json = sub.toJSON();
    const res = await fetch('/api/mobile/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
    });
    if (!res.ok) {
      await sub.unsubscribe().catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
