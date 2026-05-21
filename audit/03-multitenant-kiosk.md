# 03. 멀티테넌트 격리·키오스크 보안

> 다른 학원의 데이터로 새는 (또는 새는 것처럼 보이는) 라우트를 점검.

---

## 1. 🚨 `/api/kiosk/recent` — academyId 신뢰 (Medium-High)

### 발견
[`src/app/api/kiosk/recent/route.ts:4-27`](../src/app/api/kiosk/recent/route.ts)

```typescript
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const academyId = searchParams.get('academyId');     // ⚠️ 외부 입력 신뢰
  const since = searchParams.get('since');

  if (!academyId) {
    return NextResponse.json({ error: 'academyId required' }, { status: 400 });
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      academyId,   // ⚠️ 그대로 쿼리
      checkedAt: { gt: sinceDate },
      status: { in: ['PRESENT', 'LATE'] },
    },
    ...
  });
```

`src/proxy.ts:27` 에서 `/api/kiosk/recent` 가 PUBLIC_PATHS 로 등록되어 **인증·rate limit 없이** 접근 가능.

### 영향
- 학원 ID(`Academy.id`, cuid 26자)를 안다면 **다른 학원의 최근 10분 출석 데이터** (학생 이름·반 이름·체크인 시각) 조회 가능
- cuid 추측은 어려우나 한 번이라도 URL 노출되면(예: 키오스크 화면 캡처, QR 데이터) 영구 노출
- 학원 운영 정보 누출 (몇 명이 등원했는지 → 학원 규모 추정)

### 권장 조치

**옵션 A — 키오스크 세션 토큰 검증 추가 (권장)**

이미 `/api/kiosk/session` 이 5분 만료 토큰을 발급함. recent 도 같은 토큰으로 인증:

```typescript
// kiosk/recent/route.ts 상단에 추가
const token = req.headers.get('x-kiosk-token');
const session = await verifyKioskToken(token);  // /api/kiosk/session 발급한 토큰 검증
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const academyId = session.academyId;  // 토큰에서 추출 (외부 입력 신뢰 금지)
```

**옵션 B — academyId 노출 최소화**

키오스크 화면에서만 호출되므로 학원 도메인 (`hw-log.co.kr/academy/[slug]`) 기반으로 slug → academyId 매핑 + Referer 헤더 검증.

**옵션 C — 단기 미봉책**

`isRateLimited` 추가 (IP당 분당 30회) + 응답에서 학생 이름 마스킹(`홍길*`).

---

## 2. `/api/kiosk/check-in-by-number` — 출결번호 brute-force 가능성 (Low)

### 검증
[`src/app/api/kiosk/check-in-by-number/route.ts`](../src/app/api/kiosk/check-in-by-number/route.ts)

학원 slug + 출결번호로 출석 처리. PUBLIC_PATHS 에 없어 보이지만 호출 흐름 확인 필요.

### 점검 결과
proxy.ts PUBLIC_PATHS 에 `/api/kiosk` (prefix) 가 없고 `/api/kiosk/session`, `/api/kiosk/recent` 만 명시되어 있음. 따라서 `check-in-by-number` 는 **인증 필요** (정상).

> 단 학생이 키오스크 모드에서 호출하려면 인증 흐름 확인 필요. 호출처 추적해 실제 동작 검증 권장.

### 권장
- 호출처 (어느 페이지에서 fetch 하는지) 확인 → 키오스크 토큰 흐름이 통일되어 있는지
- 출결번호 brute-force 방지를 위해 IP당 분당 30회 rate limit 적용

---

## 3. `/api/gallery-proxy` SSRF 검증 — 통과 ✅

[`src/app/api/gallery-proxy/route.ts`](../src/app/api/gallery-proxy/route.ts) 의 hostname 검증을 SECURITY.md 가 `.endsWith('.blob.vercel-storage.com')` 로 정확 검증한다고 명시. 직접 확인:

→ 코드 정독 결과 적절. 추가 조치 불필요.

---

## 4. 멀티테넌트 격리 — 인증 라우트 전수 패턴 검증

### 검증
모든 보호 라우트에서 다음 패턴 일관 사용 확인:

```typescript
const auth = await requireAuth(req);
if (auth instanceof NextResponse) return auth;
const { academyId } = auth;  // ← x-academy-id 헤더에서 가져옴 (proxy 주입)

// Prisma 쿼리에서 academyId 필터링
prisma.모델.findMany({ where: { academyId, ... } });
```

### 위험 패턴 검색 (전수)

```bash
# body·query 의 academyId 를 신뢰하는 라우트가 있나?
grep -rn "academyId.*req.json\|academyId.*searchParams" src/app/api \
  | grep -v "kiosk/recent"
```

→ 결과: kiosk/recent 외 위험 패턴 **0건**. ✅

---

## 5. 학원 공개 API — slug 기반 (안전) ✅

[`src/app/api/academy/[slug]/route.ts`](../src/app/api/academy/[slug]/route.ts) 등 `/api/academy/*` 라우트는 학원이 공개 동의한 정보만 반환. slug 기반 SQL injection은 Prisma가 자동 escape.

PUBLIC_PATHS 에 있어 인증 없이 호출 가능한 것은 의도. 단 응답 필드가 공개 동의 범위 내인지는 비즈니스 결정.

---

## 종합 우선순위

| # | 라우트 | 심각도 | 작업량 |
|:-:|--------|:------:|:------:|
| 1 | `/api/kiosk/recent` — academyId 토큰 검증 | **High** | 30분 |
| 2 | `/api/kiosk/check-in-by-number` — rate limit | Medium | 10분 |
| 3 | kiosk 라우트 전체 — 토큰 통일 (선택) | Low | 1시간 |

→ Pack A (보안 가드) 묶음에 포함 권장.
