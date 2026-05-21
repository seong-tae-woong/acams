# 01. 보안 점검 — 헤더·인증·Rate Limit

> SECURITY.md(이미 추적 중인 잔여 이슈)와 별개로, **재점검 결과**와 **새로 확인된 사항**을 정리한다.

---

## 1. 🚨 보안 헤더 0개 — `next.config.ts` (SECURITY.md #4 그대로)

### 현황
[`next.config.ts`](../next.config.ts) 가 사실상 빈 객체로, 보안 헤더가 **0개** 설정되어 있다.

```typescript
const nextConfig: NextConfig = {
  // PORT 환경변수가 있으면 해당 포트 사용 (preview tool 자동포트 지원)
};
```

### 영향
- **Clickjacking**: 외부 사이트가 학원로그를 iframe 으로 임베드해 클릭 하이재킹 가능
- **MIME sniffing**: 업로드된 이미지가 HTML로 해석되어 XSS 발생 가능
- **HTTPS downgrade**: HSTS 없음 → 한 번이라도 HTTP로 접속하면 MITM 노출
- **Referrer 누수**: 학원 내부 URL이 외부 사이트로 referrer 헤더로 흘러나갈 수 있음

### 권장 조치 (5분 작업)

`next.config.ts` 를 다음과 같이 수정:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

> **주의**: `X-Frame-Options: DENY`로 설정하면 학원 공개 페이지(`/academy/[slug]`)도 외부 임베드 불가. 임베드를 허용하려면 `SAMEORIGIN` 또는 `frame-ancestors` 기반 CSP 사용.
>
> **카메라 권한**: 키오스크 QR 스캔(`html5-qrcode`)이 카메라 사용 → `camera=(self)` 필수.

---

## 2. Rate Limit 현황 — 적절 (SECURITY.md #1 트래픽 후 보강)

### 검증
[`src/proxy.ts:43-50`](../src/proxy.ts) 글로벌 IP rate limit 적용 + 핵심 라우트별 추가 제한.

| 라우트 | 한도 |
|--------|------|
| `/api/*` 글로벌 | 600/분 (proxy.ts) |
| `/api/auth/login` | 20/15분 |
| `/api/auth/change-password` | 10/15분 |
| `/api/kiosk/session` | 30/분 |
| `/api/academy/[slug]/inquiry` | 5/시간 |
| `/api/gallery-proxy` | 100/분 |

### 평가
- **현재 메모리 기반** (`Map` 저장) → Vercel 멀티 인스턴스에서 인스턴스 수만큼 한도 곱해짐
- **하지만**: `User.lockedUntil` 이 DB 단위로 5회 실패 → 30분 락 → brute-force 사실상 차단
- DDoS 는 Vercel/Cloudflare 레이어 책임

### 조치 시점
트래픽 증가 신호(월 활성 학원 50개 이상 또는 의심 트래픽 관찰)가 보이면 **Upstash Redis** 로 교체.

---

## 3. 인증 패턴 검증 — 일관됨 ✅

### 검증 결과
- `requireAuth` 호출 후 `instanceof NextResponse` 체크 패턴이 보호 라우트 109개에 일관 적용
- `proxy.ts`에서 JWT 검증 + tokenVersion 헤더 주입 → API 라우트가 헤더로 신뢰
- 비밀번호 강제 변경 (`mustChangePassword`) → `/change-password` 외 모든 경로 차단 ([proxy.ts:84-86](../src/proxy.ts))

### 사소한 권장
- `tokenVersion`을 헤더에 넣어두는데, 실제 사용처는 일부 라우트만(`validateSession`). 모든 쓰기 라우트에서 검증하지 않는 것이 의도인지 SECURITY.md에 명시 권장.

---

## 4. JWT 만료 정책 — 환경변수 불일치 의심

### 발견
- [`SECURITY.md:18`](../SECURITY.md) 기재: `JWT_EXPIRES_IN=1d`
- [`README.md:57`](../README.md) 환경변수 예시: `JWT_EXPIRES_IN=7d`

### 영향
- 두 문서 불일치 → 실제 운영 환경 어느 값인지 확인 필요
- 1d 가 안전. 7d 면 토큰 탈취 시 노출 창이 7배

### 권장
실제 Vercel 환경변수 확인 후 둘 중 한쪽 문서 수정.

---

## 5. 토스 결제 키 보관 — 적절 ✅

### 검증
- 학원별 Toss Secret Key를 **AES-256-GCM 으로 암호화** 후 DB 보관
- 암호화 키는 `TOSS_KEY_ENC_SECRET` 환경변수 (README.md:61)
- Client Key는 평문 가능 (브라우저에 노출되는 키)

> 키 회전 정책은 별도 운영 절차 필요 (현재 미문서화).

---

## 6. 비밀번호 정책 — 강력 ✅

| 항목 | 적용 |
|------|------|
| 길이 | 8자 이상 |
| 복잡도 | 영문 + 숫자 + 특수문자 필수 |
| 이력 | 최근 3개 재사용 금지 |
| 만료 | 90일 (director, super_admin 한정) |
| 잠금 | 5회 실패 → 30분 |
| Hash | bcrypt cost factor 12 |

---

## 7. 감사 로그 — 무한 증가 (SECURITY.md #7 그대로)

### 현황
`AuditLog` 테이블에 LOGIN_SUCCESS / FAILURE / LOCKED, PASSWORD_CHANGE / RESET 기록. **삭제·아카이브 정책 없음**.

### 영향
- 1년치 누적 시 Neon DB 용량 증가 → 비용
- 쿼리 성능 저하 (특히 IP 단위 검색)

### 권장
SECURITY.md #7 가이드대로 **365일 이상 삭제 cron** 추가. Vercel Cron Functions 무료 한도 내 가능.

---

## 8. 비공개 데이터 노출 검증 — 양호 ✅

### 검증
- `console.error` 시 `err instanceof Error ? err.message : String(err)` 패턴으로 스택 노출 차단
- API 응답 메시지에 DB 구조·쿼리 노출 없음
- 환경변수 `.env`, `.env.local` 은 `.gitignore` 의 `.env*` 패턴으로 제외됨 ✅

---

## 종합

| 분류 | 항목 | 즉시? |
|------|------|:----:|
| 🚨 High | 보안 헤더 4종 추가 | ✅ |
| ⚠️ Medium | JWT_EXPIRES_IN 문서 일치 | ✅ |
| 📝 Info | 감사 로그 보관 정책 (cron) | 운영 안정 후 |
| 📝 Info | Upstash Redis | 트래픽 증가 후 |
| 📝 Info | MFA (SECURITY.md #5) | 운영 안정 후 |

**다른 라우트별 보안 이슈는 [02-api-roles.md](02-api-roles.md), [03-multitenant-kiosk.md](03-multitenant-kiosk.md) 참고.**
