// AcaMS Service Worker — 오프라인 fallback + 정적 자산 캐싱
const CACHE_NAME = 'acams-v3'; // 버전 업 → 구버전 캐시 강제 제거

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
