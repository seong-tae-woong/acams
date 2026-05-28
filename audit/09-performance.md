# 09. 성능·번들·이미지

> 빌드 결과 + 정적 자산 점검. **전반적으로 양호**.

---

## 1. 빌드 산출물 — 양호 ✅

### 청크 크기 (상위 10, server)

| 라우트 | 크기 |
|--------|-----:|
| `/(admin)/classes/lessons` | 11,115 B |
| `/(admin)/communication/report-templates` | 10,920 B |
| `/(admin)/students` | 10,681 B |
| `/(admin)/analytics` | 10,651 B |
| `/(admin)/classes/makeup` | 10,455 B |
| `/mobile/reports/[id]` | 10,448 B |
| `/(admin)/finance/settlement` | 10,442 B |
| `/(admin)/finance/billing` | 10,378 B |
| `/(admin)/communication/notifications` | 10,336 B |
| `/(admin)/settings` | 10,336 B |

→ 모든 페이지가 **10-11 KB** 수준으로 균일. 거대 라우트 없음 ✅

> `.next/` 전체 799 MB 는 빌드 중간 산출물 포함. 실제 배포 번들은 훨씬 작음.

---

## 2. 정적/동적 분리 — 정상 ✅

빌드 결과 `○ (Static)` vs `ƒ (Dynamic)` 분류:

- 대부분 페이지: `○` 정적 prerender (proxy 가 동적 인증)
- `ƒ /mobile/reports/[id]`, `/super-admin/academies/[id]` 등 동적 라우트만 SSR
- Proxy(Middleware): `ƒ`

→ 적절. 정적 prerender 최대 활용.

---

## 3. 이미지 — 5건 `<img>` 직접 사용

| 위치 | 평가 | 권장 |
|------|------|------|
| `src/app/(admin)/settings/_tabs/ProfileTab.tsx:263` | 관리자 갤러리 | OK (관리자) |
| `src/app/academy/[slug]/page.tsx:179,611,635` | 학원 공개 갤러리 | LCP 영향 가능, next/image 검토 |
| `src/app/kiosk/page.tsx:422` | QR data URL | OK |

### `public/` 정적 이미지 크기

| 파일 | 크기 |
|------|-----:|
| `icon-192.png` | 1.5 KB |
| `icon-512.png` | 1.5 KB |
| `next.svg`, `globe.svg`, `file.svg`, `window.svg`, `vercel.svg` | < 1.5 KB |

→ Next.js 기본 SVG (사용 안 하면 제거 가능). 큰 영향 없음.

### 권장 (선택)
- 사용 안 하는 default SVG 제거: `next.svg`, `globe.svg`, `file.svg`, `window.svg`, `vercel.svg`
- 학원 공개 페이지 next/image 전환 검토 (`05-ui-consistency.md` 와 중복)

---

## 4. Pretendard 폰트 — CDN 의존

[`README.md:29`](../README.md): jsDelivr CDN.

### 평가
- ✅ 빠른 CDN
- ⚠️ 외부 의존 (CDN 장애 시 fallback 폰트)
- ⚠️ next/font 미사용 → CLS 가능성

### 권장 (선택)
- `next/font/local` 로 self-host 전환 시 CLS 0
- 단 폰트 파일 크기(2-5 MB) 추가 부담. 트래픽 vs 사용성 trade-off

→ 현재는 OK. 트래픽 늘면 검토.

---

## 5. Recharts 번들 사이즈 — 검토

[`src/components/charts.tsx`](../src/components/charts.tsx) (가정) Recharts 사용.

### 잠재 이슈
Recharts 는 무겁다 (300+ KB). 사용 페이지만 lazy load 시 초기 번들 축소.

### 권장 (선택)
```typescript
import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('@/components/charts'), { ssr: false });
```

→ 트래픽·LCP 측정 후 결정.

---

## 6. DB 쿼리 N+1 — 정적 점검 한계

### 한계
Prisma `include` 깊이 / `findMany` 후 map 안에서 `findOne` 호출 등은 정적으로 일부만 검출 가능.

### 의심 후보
현재 정적 분석으로 명확히 식별된 N+1 쿼리는 없음 (학생 코멘트 N+1은 기능 제거와 함께 해소).

### 권장 (선택)
- 의심 라우트 (lookup, analytics 등) 실제 측정 후 결정
- Prisma `relationLoadStrategy: 'join'` 옵션 검토

---

## 7. 캐싱 전략 — 점검 미수행

### 미검토 항목
- `cache-control` 헤더 (현재 next.config.ts 에 미설정)
- API 응답 캐싱 (Vercel Edge Cache)
- SWR / React Query 등 클라이언트 캐시 (현재 zustand 직접 fetch?)

### 권장
- 정적 페이지 (학원 공개)에 `s-maxage=300, stale-while-revalidate` 추가 가능
- 보호 페이지는 캐시 금지 (현재 기본값 OK)

---

## 8. Lighthouse / Web Vitals — 미측정

본 점검에서 LCP·FID·CLS 미측정. 실측 권장:

```bash
# Vercel 배포 후 PageSpeed Insights 측정
# 또는 로컬: lighthouse https://hw-log.co.kr/mobile --view
```

---

## 종합

| # | 항목 | 평가 | 작업 |
|:-:|------|:----:|------|
| 1 | 빌드 청크 크기 | A | 유지 |
| 2 | 정적/동적 분리 | A | 유지 |
| 3 | `<img>` (학원 공개 페이지) | B | LCP 측정 후 next/image |
| 4 | 사용 안 하는 default SVG 제거 | C | 청소 작업 (선택) |
| 5 | Recharts lazy load | B | LCP 측정 후 결정 |
| 6 | N+1 쿼리 (lookup) | B | 학원 규모 5개 이상 시 측정 |
| 7 | Lighthouse 측정 | 미수행 | 별도 작업 |

**시급한 성능 이슈 없음.** 트래픽 신호 보고 측정 → 결정 권장.
