import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PORT 환경변수가 있으면 해당 포트 사용 (preview tool 자동포트 지원)
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
