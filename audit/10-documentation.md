# 10. 문서·TODOS 정리

> README, CLAUDE.md, AGENTS.md, SECURITY.md, TODOS.md 정독 결과.

---

## 1. 문서 인벤토리 — 양호 ✅

| 파일 | 길이 | 갱신성 | 평가 |
|------|:----:|:------:|------|
| `README.md` | 충실 | 최신 | 기술스택·환경변수·시드·도메인·31개 모델 풀스펙 | A |
| `CLAUDE.md` | 174줄 | 최신 | §1 도메인 인덱스 + §3 절대 규칙 — 작업 가이드 우수 | A+ |
| `AGENTS.md` | 짧음 | 최신 | "Next.js 16 breaking changes 경고" | A |
| `SECURITY.md` | 228줄 | 2026-05-07 | 적용 완료 + 잔여 P3 7건 추적 | A |
| `TODOS.md` | 53줄 | 2026-05-20 | 인강·이수 7건 (P2-P3) | A |

→ **전반적으로 매우 잘 관리됨**. 새 기여자가 빠르게 적응 가능한 구조.

---

## 2. CLAUDE.md §1 도메인 인덱스 — 갱신 검증

### 검증
도메인 인덱스 (학생·반·출결·성적·재무·소통·캘린더·통계·인강·모바일·키오스크·슈퍼어드민·인증·학원공개) 14개 행이 실제 코드와 일치하는지 spot check.

→ 큰 누락 없음. ✅

### 사소한 발견
- `assignments`, `lessons`, `reports`, `class-events`, `lecture-series` 도메인이 §1 인덱스에 명시되지 않음
  - `src/app/api/assignments/*` → 과제 도메인 (반 도메인 일부일 가능성)
  - `src/app/api/lessons/*` → 수업·클리닉 (CLAUDE.md 의 lessons UI page 와 매핑)
  - `src/app/api/reports/*` → 리포트 발행 (성적 도메인 일부)
  - `src/app/api/lecture-series/*` → 인강 시리즈 (인강 도메인 일부)
  - `src/app/api/class-events/*` → 반 이벤트 (캘린더 도메인 일부)

### 권장 (선택, 10분)
§1 인덱스에 위 5개 도메인 행 추가. 또는 기존 행에 API 경로 추가 (예: 인강 행에 `lecture-series/`).

---

## 3. SECURITY.md 갱신 권장

### 본 점검에서 발견된 항목 추가 권장

**잔여 이슈에 추가**:
- **#8 — `/api/kiosk/recent` academyId 신뢰 (Medium-High)**
  - 본 점검 [03-multitenant-kiosk.md](03-multitenant-kiosk.md) §1 참고
  - 즉시 조치 권장
- **#9 — JWT_EXPIRES_IN 문서 불일치**
  - SECURITY.md (1d) vs README.md (7d)
  - 실제 운영 값 확인 후 통일

**기존 #2 검증 결과 추가**:
- 본 점검에서 전수 조사 → **62개 쓰기 라우트에 role 가드 없음**
- 위험 분류: A 재무·운영 (17개, 즉시), B 학사 (32개, 의도 확인), C 모바일 (14개), D 태블릿 (10개, proxy 가드)
- 상세는 [audit/02-api-roles.md](02-api-roles.md) 참고로 링크

### 권장 갱신 시점
보안 가드 작업 PR 머지 후 SECURITY.md 갱신.

---

## 4. TODOS.md — 활용 잘됨 ✅

### 평가
- 인강·이수 P2/P3 작업 7건이 명확히 정리됨
- "무엇 / 왜 / 현재 상태 / 출발점 / 선행 조건 / Effort" 구조 우수
- Effort 가 human + CC 둘 다 표기 — 잘된 패턴

### 추가 등록 권장 (본 점검에서 도출)

```markdown
### 8. API role 가드 일괄 추가 (P1)
- **무엇**: 쓰기 API 62개 중 재무·운영 17개에 director/super_admin 가드 추가
- **왜**: SECURITY.md #2 재점검. teacher 계정 탈취 시 청구서 일괄 조작 가능.
- **출발점**: audit/02-api-roles.md §A 의 17개 라우트 일괄 패치.
- **Effort**: S (human ~3시간 / CC ~30분)

### 9. 보안 헤더 추가 (P1)
- **무엇**: next.config.ts 의 headers() 에 HSTS·X-Frame-Options 등 4종 추가
- **왜**: SECURITY.md #4. clickjacking·MIME sniffing 방어.
- **Effort**: XS (human ~10분 / CC ~3분)

### 10. 키오스크 recent 토큰 검증 (P1)
- **무엇**: /api/kiosk/recent 에 키오스크 세션 토큰 검증 추가
- **왜**: audit/03-multitenant-kiosk.md #1. academyId 외부 신뢰 → 멀티테넌트 격리 위반.
- **Effort**: S (human ~30분 / CC ~10분)

### 11. 인강 mockup 페이지 명시 (P2)
- **무엇**: 4개 mockup 페이지에 "샘플 데이터" 배너 추가
- **왜**: audit/07-ingang.md #2. 운영 데이터로 착각 위험.
- **Effort**: XS (human ~10분 / CC ~3분)
```

---

## 5. SECURITY.md vs README.md 환경변수 불일치

### 발견
- SECURITY.md:18 → `JWT_EXPIRES_IN=1d`
- README.md:57 → `JWT_EXPIRES_IN=7d`

### 조치
실제 Vercel `JWT_EXPIRES_IN` 환경변수 확인 후 두 문서 중 하나 수정. **1d 권장** (보안).

---

## 6. AGENTS.md — 짧지만 효과적 ✅

```
This version has breaking changes ... Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code.
```

→ Next.js 16 breaking changes 강한 경고. AI 코딩 에이전트가 train 데이터의 구버전 패턴 사용 방지. **잘된 디테일**.

---

## 7. 기타 루트 문서들 (`AcaMS_*.md`, `AcaMS_*.pdf`)

상위 디렉토리에 기획서·설계 문서 다수 존재:
- `AcaMS_기획서_v1.1.md` ~ `v1_4.md` (4개 버전)
- `AcaMS_보강수업관리_설계.md`
- `AcaMS_수업관리_수업이력_설계.md`
- `AcaMS_수업관리_학생별이력_설계.md`
- `AcaMS_원장님_소개서.pdf`
- `AcaMS_화면구조도.pdf`

### 권장 (선택)
- 옛 버전 (`_v1.1`, `_v1.2` 등) 은 `archive/` 폴더로 이동하거나 git 만 남기고 삭제 — 헷갈림 방지
- 또는 README.md 에 "현재 유효 기획서: v1_4" 명시

→ 비기술 문서라 점검 범위 밖. **참고 사항**.

---

## 종합

| # | 항목 | 평가 | 작업 |
|:-:|------|:----:|------|
| 1 | 핵심 문서 5종 (README·CLAUDE·AGENTS·SECURITY·TODOS) | A | 유지 |
| 2 | CLAUDE.md §1 인덱스 누락 도메인 5개 추가 | A- | 10분 (선택) |
| 3 | SECURITY.md 본 점검 발견 추가 (#8·#9) | A | 보안 PR 후 갱신 |
| 4 | TODOS.md 본 점검 발견 4건 추가 | A | 10분 (선택) |
| 5 | JWT_EXPIRES_IN 문서 일치 | A | 5분 |
| 6 | 기획서 옛 버전 정리 | B | 별도 (비기술) |

**문서 품질은 매우 우수.** 본 점검 결과 통합만 짧게 진행 권장.
