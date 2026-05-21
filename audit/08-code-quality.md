# 08. 코드 품질

> TypeScript·console·any·TODO·중복 점검 결과. **전반적으로 양호**.

---

## 1. TypeScript 검증 — 통과 ✅

```bash
$ npx tsc --noEmit
# 0 errors
```

55개 페이지, 130개 API 라우트, 33개 컴포넌트, 31개 Prisma 모델 모두 타입 정합.

---

## 2. Next.js 빌드 — 통과 ✅

```bash
$ npx next build
# 0 warnings, 0 errors
# 모든 페이지 정적/동적 생성 정상
```

특이 사항: Proxy(Middleware) 정상 컴파일. App Router 의 (admin) route group 정상.

---

## 3. `console.log` 사용 — 의도된 로깅 3건 ✅

| 파일 | 라인 | 평가 |
|------|:----:|------|
| `src/app/api/ingang-tablet/progress/route.ts` | 28 | `[INGANG.progress]` 운영 로깅 |
| `src/app/api/ingang-tablet/quiz/start/route.ts` | 18 | `[INGANG.quiz.start]` 운영 로깅 |
| `src/app/api/ingang-tablet/quiz/submit/route.ts` | 19 | `[INGANG.quiz.submit]` 운영 로깅 |

→ 모두 의도된 진단 로깅. **유지**.

> 향후 logger 도입 (pino, winston 등) 시 console.log → logger.info 치환 권장. 현재 규모에선 OK.

---

## 4. `any` 타입 — 수기 작성 7건 ✅

`src/generated/` (Prisma 자동 생성) 제외 시:

| 파일 | 개수 | 평가 |
|------|:----:|------|
| `src/app/api/reports/publish-periodic/route.ts` | 2 | 검토 권장 |
| `src/components/reports/charts.tsx` | 1 | Recharts 타입 회피일 가능성 |
| `src/components/communication/BatchReportsModal.tsx` | 1 | |
| `src/app/mobile/reports/[id]/page.tsx` | 1 | |
| `src/app/mobile/attendance-check/page.tsx` | 1 | |
| `src/app/api/reports/publish/route.ts` | 1 | |

→ 매우 적은 수. **무시 가능**.

### 권장 (선택)
시간 여유 시 각 위치 정독하여 unknown 으로 narrow 가능한지 검토. ROI 낮음.

---

## 5. TODO / FIXME / XXX / HACK — 0건 ✅

코드베이스에 미해결 TODO 주석 없음. **모든 작업이 TODOS.md 로 외부화** 되어 있음 — 우수한 관리 패턴.

---

## 6. 중복 코드 검출 — 점검 한계

### 한계
정적 점검으로 의미적 중복 (semantic duplication) 자동 검출 불가. 잠재 후보:
- `src/app/api/*` 의 비슷한 CRUD 라우트들
- 모바일 API 의 parent/student 분기 패턴 (CLAUDE.md §5 에 명시됨 → 의도된 반복)

### 권장 (선택)
- `requireRole(auth, ['director', 'teacher'])` 헬퍼 도입 (02-api-roles.md 참고)
- 모바일 인증 분기를 `getMobileUser(req)` 헬퍼로 추출 (CLAUDE.md §5 코드 한 군데로 모음)

이 두 헬퍼만 추가하면 130개 라우트 일관성 + 신규 라우트 작성 부담 감소.

---

## 7. 미사용 코드 (dead code) — 점검 한계

### 한계
TypeScript 컴파일러는 미사용 변수 (`noUnusedLocals`) 정도 검출. 미사용 export·미사용 파일은 별도 도구 필요.

### 권장 (선택)
```bash
# 미사용 export 검출 (knip 또는 ts-prune)
npx knip
```

본 점검에서는 미실행.

---

## 8. 종속성 보안 (npm audit) — 점검 미수행

### 권장 (별도 작업)
```bash
npm audit --production
```

vulnerable dependency 있으면 별도 트랙으로 패치.

---

## 9. ESLint·Prettier — 미설정

### 발견
`package.json` 에 eslint/prettier 의존성 없음. `next.config` 도 lint 설정 없음.

### 영향
- 코드 스타일 일관성은 현재 수동
- 신규 기여자가 들어오면 스타일 가이드 부재

### 권장 (선택, 1시간)
```bash
npm install -D eslint eslint-config-next prettier
npx eslint --init
```

`package.json` 에 `lint` 스크립트 추가. CI 에 lint check 추가.

> 현재 1인 개발 단계라면 후순위. 협업 시 필수.

---

## 종합

| 항목 | 평가 | 비고 |
|------|:----:|------|
| TypeScript | A | 0 errors |
| Next build | A | 0 warnings |
| console.log | A | 3건 의도적 |
| any | A | 7건 (영향 미미) |
| TODO 주석 | A | 0건 (TODOS.md 외부화 우수) |
| 중복 코드 | B+ | 헬퍼 도입 시 추가 개선 가능 |
| 미사용 코드 | 미점검 | knip 도입 권장 |
| ESLint | 미설정 | 협업 시 도입 |
| npm audit | 미점검 | 별도 작업 |

**코드 품질 부채 매우 낮음.** 개선 작업의 ROI는 보통 → 보안·UX 작업 후 진행.
