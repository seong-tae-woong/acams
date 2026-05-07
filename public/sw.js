// AcaMS Service Worker — 오프라인 fallback + 정적 자산 캐싱 + Web Push
const CACHE_NAME = 'acams-v4'; // 버전 업 → 구버전 캐시 강제 제거

// 설치: 정적 자산만 캐싱 (/mobile은 인증 필요하므로 제외)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/manifest.json'])
    )
  );
  self.skipWaiting();
});

// 활성화: 구버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch: 네트워크 우선, 실패 시 캐시 fallback
self.addEventListener('fetch', (event) => {
  // API 요청은 캐싱하지 않음
  if (event.request.url.includes('/api/')) return;
  // GET 요청만 처리
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공 응답이고 리다이렉트되지 않은 경우에만 캐시
        // (리다이렉트된 경우: 미인증 상태로 /mobile 접근 시 /login으로 리다이렉트된 내용이
        //  /mobile URL 키로 잘못 캐시되는 문제 방지)
        if (response.ok && !response.redirected) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? new Response('오프라인 상태입니다.', { status: 503 }))
      )
  );
});

// Web Push 수신 — 서버에서 webpush.sendNotification 호출 시 트리거
self.addEventListener('push', (event) => {
  let payload = { title: 'AcaMS', body: '새 알림이 도착했습니다.', url: '/mobile/notifications', studentId: null };
  if (event.data) {
    try { payload = { ...payload, ...event.data.json() }; } catch { /* keep defaults */ }
  }
  // payload.studentId가 있으면 url에 ?student=<id> 부여 → 앱 진입 시 해당 자녀로 자동 전환
  const baseUrl = payload.url || '/mobile/notifications';
  const targetUrl = payload.studentId
    ? baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'student=' + encodeURIComponent(payload.studentId)
    : baseUrl;
  const options = {
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag,
    data: { url: targetUrl },
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// 알림 클릭 — 해당 url을 열거나 이미 열린 탭에 포커스
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/mobile/notifications';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientsList) {
      try {
        const url = new URL(c.url);
        if (url.pathname.startsWith('/mobile')) {
          await c.focus();
          if ('navigate' in c) await c.navigate(targetUrl);
          return;
        }
      } catch { /* skip */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
