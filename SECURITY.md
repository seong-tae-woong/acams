# AcaMS 보안 — 잔여 이슈 트래킹

이 문서는 AcaMS 인증·인가·데이터 보호 영역에서 **현재 적용된 조치**와 **중장기 개선이 필요한 잔여 이슈**를 추적합니다. 즉시 위협이 되는 항목은 모두 처리되었으며, 아래 P3 항목들은 트래픽·운영 단계에 따라 순차 도입 권장.

---

## ✅ 적용 완료된 보안 조치

### 인증 (Authentication)
- **계정 잠금**: 5회 실패 → 30분 자동 잠금 (`User.lockedUntil`)
- **IP 기반 Rate Limiting**:
  - `/api/*` 글로벌: 600회/분 (proxy.ts)
  - `/api/auth/login`: 20회/15분
  - `/api/auth/change-password`: 10회/15분
  - `/api/kiosk/session`, `/api/kiosk/check-in`: 30회/분
  - `/api/academy/[slug]/inquiry`: 5회/시간
  - `/api/gallery-proxy`: 100회/분
- **JWT 만료**: 1일 (환경변수 `JWT_EXPIRES_IN=1d`)
- **세션 무효화 (tokenVersion)**:
  - 비밀번호 변경/리셋 → 자동 increment
  - 로그아웃 → 자동 increment
  - `validateSession()`로 reset-password / finance / announcements 등 핵심 라우트에서 검증

### 비밀번호 정책
- **복잡도**: 8자 이상, 영문 + 숫자 + 특수문자 필수
- **이력**: 최근 3개 비밀번호 재사용 금지 (`PasswordHistory`)
- **만료**: 90일 (super_admin, director 한정 → 로그인 시점에 평가)
- **강제 변경**: 임시 비밀번호 발급 시 `mustChangePassword=true` → `/change-password` 페이지로 자동 리다이렉트
- **임시 비밀번호 생성**: `crypto.randomInt()` 기반 (암호학적 난수)
- **전달 채널**: Aligo SMS (API 응답에 평문 PW 포함하지 않음)

### 데이터 보호
- **bcrypt cost factor**: 12
- **Toss Secret Key**: AES-256-GCM 암호화 보관
- **JWT secret**: 환경변수 분리
- **에러 로그 정제**: `err instanceof Error ? err.message : String(err)` (스택 / 쿼리 노출 방지)

### 멀티테넌트 격리
- 모든 API: `x-academy-id` 헤더 필수, body·query의 academyId 절대 신뢰 안 함
- proxy.ts에서 역할별 경로 접근 제어 (super_admin / director-teacher / parent-student)

### 공개 엔드포인트
- `gallery-proxy`: URL hostname 정확 검증 (SSRF 차단)
- `kiosk/session`: 키오스크 토큰 5분 만료 + IP rate limit

### 감사 로그
- `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGIN_LOCKED`, `PASSWORD_CHANGE`, `PASSWORD_RESET` 기록
- IP 주소 포함

---

## ⚠️ 잔여 보안 이슈 (P3 — 단기 위협 낮음, 중장기 권장)

### 1. 인메모리 Rate Limiter — Vercel 멀티 인스턴스 우회 가능
**현황**:
- 현재 `Map`에 저장 → Vercel 인스턴스마다 독립된 카운터
- 실제 한계: `한도 × 인스턴스 수`
- Cold start 시 카운터 리셋

**위협 평가**: 낮음
- 학원 SaaS 특성상 DDoS보다는 brute-force가 더 우려됨
- 5회 실패 시 `lockedUntil`이 **DB 단위**로 동작하므로 brute-force는 사실상 차단됨
- DDoS는 Vercel 플랫폼 / Cloudflare 레이어에서 처리되는 것이 효율적

**권장 조치**:
- 트래픽 증가 시 Upstash Redis로 교체 (무료 플랜 일 10,000 명령)
- 또는 Cloudflare 무료 플랜 추가 (도메인 NS 변경)

---

### 2. 일부 쓰기 API에 role 검증 없음
**현황**: `x-academy-id`만 확인하고 `role`은 검증하지 않는 라우트 존재.

**검토 필요 라우트**:
- `POST/PATCH/DELETE /api/communication/announcements`
- `POST/PATCH/DELETE /api/finance/bills`
- `POST/PATCH/DELETE /api/finance/expenses`
- `POST /api/calendar`

**위협**: teacher 계정으로 청구서 생성 / 공지 삭제 가능성 (의도된 권한이 아닐 경우)

**권장 조치**:
- 의도된 권한이면 README에 명시
- 아니면 각 라우트 상단에 `role !== 'director' && role !== 'super_admin'` 체크 추가

---

### 3. 비밀번호 90일 만료 — 로그인 시점에만 평가
**현황**:
- `mustChangePassword` 플래그가 로그인 시점에만 계산되어 JWT에 박힘
- JWT 만료(1일) 전까지는 87일 → 90일 경과해도 강제 변경 안 됨
- 최대 1일의 강제 변경 지연 발생

**위협 평가**: 매우 낮음 (1일 지연)

**권장 조치**:
- `validateSession()`에 `passwordChangedAt` 비교 로직 추가
- 또는 야간 cron 으로 만료된 사용자 `mustChangePassword=true` 일괄 설정

---

### 4. 보안 헤더 미설정
**현황**: `next.config.ts`에 다음 헤더가 설정되어 있지 않음.
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`

**위협**: clickjacking, MIME sniffing, downgrade 공격 가능성

**권장 조치**: `next.config.ts`의 `headers()`에 일괄 추가
```typescript
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ],
}],
```

---

### 5. MFA(2단계 인증) 없음
**현황**: 비밀번호 단일 인증

**권장 대상**: 원장 / 슈퍼어드민 계정

**권장 조치**:
- Aligo SMS 도입 후 SMS OTP 추가
- 또는 카카오 알림톡 OTP
- TOTP(Authy / Google Authenticator) 라이브러리(`speakeasy` 등) 활용

---

### 6. 감사 로그 보관 정책 없음
**현황**: `AuditLog` 테이블이 무한 증가 → 스토리지 비용 + 쿼리 성능 저하

**권장 조치**:
- 90일 또는 1년 이상 보관 후 삭제하는 cron job
- 장기 보관이 필요한 이벤트(`PASSWORD_CHANGE`, `LOGIN_LOCKED` 등)는 별도 archive 테이블로 분리
- 예시:
```typescript
// 매일 새벽 3시 실행
await prisma.auditLog.deleteMany({
  where: { createdAt: { lt: new Date(Date.now() - 365 * 86400_000) } },
});
```

---

## 우선순위 가이드

| 도입 시점 | 항목 |
|----------|------|
| 트래픽 증가 후 | #1 Upstash Redis |
| 곧 (다음 작업) | #2 role 검증, #4 보안 헤더 |
| 운영 안정화 후 | #3 만료 정책 강화, #6 감사 로그 보관 정책 |
| 사용자 증가 후 | #5 MFA |

---

## 보안 사고 발생 시 대응

1. 의심 사용자의 `tokenVersion` increment → 즉시 강제 로그아웃
2. `User.isActive = false` → 계정 비활성화
3. `AuditLog`에서 IP / 사용자 / 행위 추적
4. 비밀번호 강제 리셋 → `mustChangePassword=true` 설정

---

_최종 업데이트: 2026-05-06_
