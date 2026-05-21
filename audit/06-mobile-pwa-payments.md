# 06. 모바일 PWA·결제

> `src/app/mobile/*`, `src/components/mobile/*`, `public/sw.js`, `public/manifest.json`, 토스 결제 플로우 점검.

---

## 1. PWA 구성 — 양호 ✅

### 검증
[`public/manifest.json`](../public/manifest.json):
- `start_url`: `/mobile` ✅
- `scope`: `/mobile` ✅
- `display`: `standalone` ✅
- icons: 192/512 (any maskable) ✅
- shortcuts: 성적 리포트, 공지사항 — UX 좋음 ✅

[`public/sw.js`](../public/sw.js) (88줄):
- 캐시 버전: `acams-v4` (구버전 자동 정리) ✅
- API 요청 캐싱 제외 ✅
- 리다이렉트된 응답 캐시 제외 (로그인 페이지 잘못 캐시 방지) ✅ — **잘된 디테일**
- Web Push 핸들러 ✅
- notificationclick → 이미 열린 탭에 포커스 + navigate ✅

### 잠재 개선 (선택)
- 오프라인 fallback 페이지 따로 만들기 (현재는 `'오프라인 상태입니다.'` 텍스트만)
- 캐시 만료 정책 (현재 무한 캐시)

---

## 2. Service Worker 등록 — 점검 ✅

[`src/components/mobile/SwRegister.tsx`](../src/components/mobile/SwRegister.tsx):

```typescript
navigator.serviceWorker.register('/sw.js')
```

### 분석
- `/sw.js` 는 루트 등록 — scope를 명시하지 않으면 등록 페이지(`/mobile/*`)의 prefix만 컨트롤
- `manifest.json` 의 `scope: /mobile` 과 일치 → 정상

> 만약 향후 root scope이 필요해지면 `register('/sw.js', { scope: '/' })` 로 변경.

---

## 3. 토스 결제 플로우 — 검증 결과

### 검증 흐름
```
청구서 선택 → POST /api/mobile/payments/order (billIds 검증 · 금액 합계 검증 · PaymentOrder 생성)
  → GET /api/mobile/payments/toss-client-key (학원별 키 조회)
  → 토스 SDK requestPayment()
  → /mobile/payments/success?paymentKey=&orderId=&amount=
  → POST /api/mobile/payments/toss/confirm (Toss 승인 호출 · Bill PAID · Receipt 생성)
실패 → /mobile/payments/fail
```

### 보안 점검 결과

| 단계 | 검증 항목 | 결과 |
|------|----------|:----:|
| order | billIds 가 본인(또는 자녀) 청구서인지 | ✅ 적절 |
| order | client 의 `amount` 와 DB 계산 합계 일치 | ✅ 적절 |
| confirm | Toss 응답 금액과 PaymentOrder 금액 일치 | ✅ 적절 |
| confirm | 학생 본인 확인 | ✅ 적절 |
| webhook | HMAC 서명 검증 | ✅ 적절 |
| Secret Key | AES-256-GCM 암호화 보관 | ✅ 적절 |

### 사소한 권장 (Info)

**`/mobile/payments/success` 페이지**:
URL searchParams (`paymentKey`, `orderId`, `amount`) 를 그대로 confirm API 에 전달.

- **현재 안전한 이유**: API 서버가 Toss 와 cross-check → 클라이언트 조작 무효화
- **개선 (선택)**: `orderId` 형식 검증 (cuid 또는 UUID 정규식) — 1줄 추가로 잘못된 호출 차단

```typescript
// /mobile/payments/success/page.tsx
if (!/^[a-z0-9]{20,32}$/.test(orderId)) {
  router.replace('/mobile/payments/fail?reason=invalid_order');
  return;
}
```

---

## 4. 모바일 인증 패턴 — parent vs student 분기 검증

### CLAUDE.md §5 의 패턴
```typescript
const role = req.headers.get('x-user-role');  // 'parent' | 'student'
if (role === 'student') {
  const student = await prisma.student.findFirst({ where: { userId, academyId } });
} else if (role === 'parent') {
  const parent = await prisma.parent.findFirst({
    where: { userId },
    include: { children: { include: { student: true } } }
  });
}
```

### 검증
일부 라우트 sample 정독 — 일관된 패턴 사용 확인.

### 잠재 검증 필요
- `src/app/api/mobile/grades/route.ts`, `attendance/route.ts`, `calendar/route.ts` 등에서 parent 가 학생 본인 자녀만 볼 수 있는지 cross-academy 격리 검증
- 자녀 ID query parameter 로 받을 때 본인 자녀인지 검증하는지

→ 본 점검에서는 모든 mobile 라우트 정독 못함. **별도 트랙 권장**.

---

## 5. Web Push 구성 — 양호 ✅

### 검증
- VAPID 키 환경변수 분리 (README.md:63-66)
- `web-push` 라이브러리 사용
- 알림 클릭 시 이미 열린 탭 우선 포커스 ([sw.js:71-87](../public/sw.js))
- studentId 포함 시 자녀 자동 전환 ✅ — **잘된 UX**

### 권장
- 푸시 구독 만료 처리 (401 응답 시 PushSubscription 삭제) 자동화 확인
- 푸시 발송 실패율 모니터링 (현재 미문서화)

---

## 6. 모바일 페이지 cleanup 점검 — 한계

### 잠재 이슈
정적 점검으로는 다음을 자동 검증 불가:
- `useEffect` 에서 fetch 시 abort controller 누락 (메모리 누수)
- WebSocket / EventSource 연결 cleanup 누락
- setInterval / setTimeout cleanup 누락

### 권장
브라우저 DevTools → Performance → Memory 탭으로 모바일 페이지 5회 왕복 시 메모리 증가 확인.

---

## 종합

| # | 항목 | 평가 | 작업 |
|:-:|------|:----:|------|
| 1 | PWA manifest·SW 구성 | A | 유지 |
| 2 | 토스 결제 보안 | A | 유지 (orderId 정규식 추가는 선택) |
| 3 | Web Push 구성 | A | 유지 |
| 4 | parent/student 격리 (mobile API) | B (점검 한계) | 별도 전수 검증 |
| 5 | useEffect cleanup | 미점검 | 브라우저 메모리 측정 |

**시급한 모바일 이슈 없음.** parent 격리 전수 검증만 별도 트랙으로 권장.
