# AcaMS 전반 점검 리포트 — 마스터 인덱스

> **점검 일자**: 2026-05-21
> **점검 범위**: 빌드·보안·API·DB·UI·PWA·결제·인강·코드품질·문서 전반
> **점검 방법**: 정적 분석 (TypeScript·Next 빌드·소스 grep + 핵심 파일 정독). 실제 브라우저 동작 테스트는 미수행.

---

## 1. 헬스 스코어 (한 줄 요약)

| 영역 | 점수 | 핵심 메시지 |
|------|:----:|------------|
| 빌드·타입체크 | **A** | tsc/next build 모두 깨끗하게 통과 |
| 코드 품질 | **A** | console·any·TODO 모두 양호 |
| 데이터 격리 | **A-** | requireAuth 일관됨. 단 키오스크 1개 hole |
| API role 검증 | **C** | 쓰기 API 62개에 role 가드 부재 (SECURITY.md #2 검증 결과) |
| 보안 헤더 | **D** | next.config.ts 헤더 0개 (SECURITY.md #4 그대로) |
| 인강 영역 | **B-** | DB 연동부 양호. 목업 4개 페이지 UI 표시 부재 |
| UI 일관성 | **B** | 디자인 토큰 위반 일부, 공용 컴포넌트 사용은 양호 |
| 모바일 PWA | **A-** | SW/manifest/결제 모두 안전 |
| 문서 | **A** | README·CLAUDE·SECURITY·TODOS 모두 최신 |
| **종합** | **B** | **즉시 위협은 적음. 권한 가드와 보안 헤더가 가장 큰 부채** |

---

## 2. Top 3 우선 작업 (가장 ROI 높음)

### 🥇 1순위 — API role 가드 일괄 추가
- **무엇**: 쓰기 API 62개 중 청구서·지출·영수증·공지 등 **재무·운영 라우트 16개**에 director/super_admin 가드 추가
- **왜**: teacher 계정 탈취 시 청구서 일괄 생성·삭제 가능. 학원 SaaS의 운영 신뢰 직결
- **상세**: [02-api-roles.md](02-api-roles.md)
- **공수**: 인간 ~3시간 / CC ~30분 (대부분 1줄 추가)

### 🥈 2순위 — 보안 헤더 추가 (`next.config.ts`)
- **무엇**: HSTS·X-Frame-Options·X-Content-Type-Options·Referrer-Policy 4종
- **왜**: clickjacking·MIME sniffing 방어. 5분 작업으로 보안 레벨 점프
- **상세**: [01-security.md](01-security.md) §1
- **공수**: 인간 ~10분 / CC ~3분

### 🥉 3순위 — `/api/kiosk/recent` academyId 검증 보강
- **무엇**: 현재 query string의 academyId를 그대로 신뢰. 다른 학원 ID 추측 시 출석 데이터 노출 가능
- **왜**: 멀티테넌트 격리 원칙 위반. 학원 SaaS의 기본 보장 깨짐
- **상세**: [03-multitenant-kiosk.md](03-multitenant-kiosk.md)
- **공수**: 인간 ~30분 / CC ~10분 (토큰 검증 추가)

---

## 3. 영역별 리포트 인덱스

| # | 영역 | 파일 | 핵심 발견 | 우선순위 |
|:-:|------|------|----------|:--------:|
| 01 | 보안 (헤더·rate limit·인증) | [01-security.md](01-security.md) | 보안 헤더 0개 | High |
| 02 | API role 가드 누락 | [02-api-roles.md](02-api-roles.md) | 쓰기 62개 / 위험 16개 | High |
| 03 | 멀티테넌트·키오스크 | [03-multitenant-kiosk.md](03-multitenant-kiosk.md) | kiosk/recent hole 1건 | High |
| 04 | Prisma 스키마·DB | [04-prisma-schema.md](04-prisma-schema.md) | 인덱스 1건 추천 | Low |
| 05 | UI·디자인 토큰 | [05-ui-consistency.md](05-ui-consistency.md) | 색상 하드코딩 일부 | Low |
| 06 | 모바일 PWA·결제 | [06-mobile-pwa-payments.md](06-mobile-pwa-payments.md) | 큰 이슈 없음 | Info |
| 07 | 인강·이수 | [07-ingang.md](07-ingang.md) | 목업 페이지 UI 명시 | Medium |
| 08 | 코드 품질 | [08-code-quality.md](08-code-quality.md) | 양호 | Info |
| 09 | 성능·번들 | [09-performance.md](09-performance.md) | 양호 | Info |
| 10 | 문서·TODOS | [10-documentation.md](10-documentation.md) | 양호 | Info |

---

## 4. 작업 분할 가이드 (한 번에 하기 부담스러우면)

> 각 묶음은 독립적으로 작업·PR화 가능. 위에서 아래로 진행 권장.

### Pack A — 보안 가드 (1-2 작업 세션)
1. 02-api-roles.md §A 의 **재무·운영 라우트 16개** role 가드 추가
2. 01-security.md §1 의 보안 헤더 4종 next.config.ts에 추가
3. 03-multitenant-kiosk.md 의 kiosk/recent 토큰화

### Pack B — 인강 UX (0.5 작업 세션)
1. 07-ingang.md 의 mockup 페이지 4개에 "샘플 데이터" 배너 추가
2. 07-ingang.md 의 Cloudflare Stream 환경변수 빌드 검증

### Pack C — UI 폴리시 (0.5 작업 세션)
1. 05-ui-consistency.md 의 하드코딩 색상 → 디자인 토큰 치환
2. 빈 상태 메시지 누락 페이지 보강

### Pack D — 인프라 부채 (장기)
- SECURITY.md #1 (Upstash Redis), #5 (MFA), #7 (감사 로그 보관) — 트래픽·운영 신호 보고 결정
- TODOS.md 인강·이수 P2/P3 작업들

---

## 5. 점검 미수행 영역 (한계)

- **실제 브라우저 동작 테스트**: 점검 도구가 Linux/Mac 가정이라 Windows에서 자동 QA 미실행. `npm run dev` 후 실사용 시나리오는 직접 클릭 테스트 필요
- **부하·성능 테스트**: DB 쿼리 N+1 가능성은 정적으로만 일부 확인. 실측 부하 테스트는 별도 트랙
- **회귀 테스트**: TODOS.md #7 (vitest 도입) 전까지 수동 QA 의존
- **종속성 취약점**: `npm audit` 미실행 (별도 작업 권장)

---

## 6. 점검 근거 요약

| 점검 도구 | 결과 |
|----------|------|
| `npx tsc --noEmit` | 0 errors |
| `npx next build` | 0 warnings, 0 errors |
| API 라우트 수 | 130개 (`find src/app/api -name route.ts`) |
| UI 페이지 수 | 55개 |
| 컴포넌트 수 | 33개 |
| Prisma 모델 수 | 31개 |
| console.log | 3건 (모두 의도된 로깅) |
| TODO/FIXME | 0건 |
| any 타입 (수기 작성) | 7건 (generated 제외) |
| `<img>` 직접 사용 | 5건 |

---

_각 영역별 상세는 같은 폴더의 번호 매겨진 MD 파일들 참고._
