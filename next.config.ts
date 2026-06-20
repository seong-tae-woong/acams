import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack 워크스페이스 루트를 이 앱(acams)으로 고정 — 상위 폴더의 stray
  // package-lock.json 때문에 루트가 잘못 추론돼 tailwindcss/@swc를 못 찾는 문제 방지.
  turbopack: {
    root: __dirname,
  },
  // PORT 환경변수가 있으면 해당 포트 사용 (preview tool 자동포트 지원)
  experimental: {
    // dynamic: 0 — 관리자/모바일 동적 페이지를 라우터 캐시에 보관하지 않음
    // 새 배포 후 브라우저가 구 캐시를 쓰다가 에러 나는 문제 방지
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // camera=(self): 키오스크 QR 스캔(html5-qrcode)에 카메라 필요
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
