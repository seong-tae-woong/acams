# 07. 인강·이수 영역

> CLAUDE.md §6 에 따르면 Phase F·DB 연동 진행 중. **DB 연동 완료 영역**과 **의도된 mockup 영역**이 혼재.

---

## 1. 영역 구분 (현재 상태)

| 라우트 | 상태 | 비고 |
|--------|------|------|
| `/ingang/lectures` (목록) | ✅ DB 연동 | `/api/lectures/` |
| `/ingang/lectures/new` (등록) | ✅ DB 연동 | Cloudflare Stream 업로드 포함 |
| `/ingang/lectures/tags` | ✅ DB 연동 | AcademyTag 모델 + 기본 태그 하드코딩 |
| `/ingang/lectures/targets` | ✅ DB 연동 | LectureTarget |
| `/ingang/lectures/student-notes` | ✅ DB 연동 | StudentLectureNote |
| `/ingang/exams` | 🟡 **mockup** | DB 모델은 있으나 페이지 하드코딩 |
| `/ingang/completion` | 🟡 **mockup** | 이수 현황 (메모리에 "곧 개발" 기록됨) |
| `/ingang/completion/stats` | 🟡 **mockup** | 시청·이수 통계 |
| `/ingang/completion/notifications` | 🟡 **mockup** | 이수 알림 발송 |
| `/ingang-tablet` (태블릿 시청) | ✅ DB 연동 | 진도율·시험 게이트 완성 |

---

## 2. 🟡 Mockup 페이지 — UI 명시 부재 (Medium)

### 발견
mockup 4페이지 (`exams`, `completion`, `completion/stats`, `completion/notifications`) 모두 **하드코딩 데이터** 로 렌더링되지만 화면에 "샘플" / "Phase F 대기" 같은 표시가 없음 (sub-agent 점검).

### 영향
- 원장·강사가 실데이터로 착각하여 의사결정 위험 (특히 통계 페이지)
- 데모 영업 시점에 노출되면 신뢰 손상

### 조치 (사용자 의도 확인됨)
> 사용자 메모리 기록: "인강 통계 화면은 의도적 목업 — 시청현황·이수율 등은 곧 개발 예정, 삭제 금지"

따라서 **페이지 자체는 유지**하되:

**옵션 A — 명시 배너 추가 (권장, 10분 작업)**

각 mockup 페이지 topbar 아래에:

```tsx
<div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-2 mb-3 rounded-lg">
  🔔 샘플 데이터입니다. Phase F (DB 연동) 작업 예정.
</div>
```

**옵션 B — 개발자만 보이는 표시**

`process.env.NODE_ENV === 'development'` 또는 super_admin 만 배너 표시 — 운영 노출 방지하면서 개발 흔적 유지.

---

## 3. Cloudflare Stream 환경변수 검증 — 런타임만

### 발견
[`src/app/api/lectures/upload-url/route.ts:14-18`](../src/app/api/lectures/upload-url/route.ts):
```typescript
if (!accountId || !apiToken) {
  return NextResponse.json(
    { error: 'Cloudflare Stream 환경변수(...) 설정되지 않았습니다.' },
    { status: 500 },
  );
}
```

런타임 호출 시점에 검증. 빌드·배포 시점에 누락 검출 안 됨.

### 영향
- Vercel 배포 후 첫 영상 업로드 시도 시 500 → 사용자 경험 저하
- 환경변수 추가 잊고 배포해도 빌드 통과

### 권장 (5분 작업, 선택)

Option 1) `next.config.ts` 또는 별도 `scripts/check-env.ts` 에서 빌드 시점 검증:

```typescript
// scripts/check-env.ts
const required = ['CF_ACCOUNT_ID', 'CF_STREAM_API_TOKEN', 'TOSS_KEY_ENC_SECRET', /* ... */];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}
```

`package.json` 의 `build` 스크립트에 prepend:
```json
"build": "ts-node scripts/check-env.ts && prisma generate && next build"
```

> 단 Vercel 환경변수는 빌드 시점에 주입되므로, `process.env` 접근 가능. 로컬 빌드와 동일하게 동작.

---

## 4. 진도율·시험 게이트 — 양호 ✅

### 검증 (sub-agent + 직접)
[`src/app/api/ingang-tablet/progress/route.ts`](../src/app/api/ingang-tablet/progress/route.ts):
- 갭 룰: 클라이언트 watchedDelta 검증 (`MAX_DELTA_SEC=6`)
- 서버 권위 delta: posDelta·timeDelta 검증 후 gap skip 로깅
- 완료 조건부 update: `WHERE completedAt = NULL` 로 race 차단

**설계 우수**. 부정 시청 1차 방어 견고.

### 향후 (TODOS.md #2)
- 패턴 기반 자동 부정 감지 (1시간에 N강 완강 등) — 별도 트랙
- 영상 재시청 강제 옵션 (TODOS.md #5)

---

## 5. 태블릿 인증 흐름 — 양호 ✅

### 검증
[`src/proxy.ts:91-112`](../src/proxy.ts):
- `role === 'tablet'` 계정은 `TABLET_ALLOWED` (`/ingang-tablet`, `/api/ingang-tablet`) 외 모두 차단
- 비-tablet 계정의 `/api/ingang-tablet` 호출 401 (단 `daily-code` 는 teacher·director OK)
- 라우트 핸들러 내부에서도 `role === 'tablet'` 이중 검증 (lookup, approve, end 등)

### IngangViewSession 상태 관리
- 학생이 출결번호 입력 → PENDING 세션 생성
- 관리자 승인 → APPROVED (`/api/ingang-tablet/approve`)
- 시청 시작 → progress 라우트가 APPROVED 검증
- 종료 → ENDED

**상태 전이 안전**. 학생이 임의로 APPROVED 만들 수 없음.

---

## 6. Cloudflare Stream 영상 보안 — 검토 필요

### 잠재 이슈
- 영상 재생 URL: `https://iframe.videodelivery.net/{cfVideoId}` (iframe)
- cfVideoId 가 노출되면 누구나 영상 시청 가능 (Stream 의 기본 설정)

### 권장 (의도 확인)
다음 중 하나가 구성되어 있는지 확인:
- **Signed URLs** (Cloudflare Stream 기능): 시청 토큰 5분 만료
- **Referrer 제한**: `acams-jmi3.vercel.app` 만 허용
- 또는 **공개 정책** (의도된 설계)

→ Cloudflare 대시보드 / 코드 확인 필요. 본 점검 범위 밖.

---

## 7. 인강 학생 노트 (StudentLectureNote)

### 검증
- 학생이 강의별 메모 작성 가능 (개인 노트)
- API: `/api/lectures/[id]/student-notes`
- requireAuth 사용 + studentId 검증

### 사소한 권장
- 노트 길이 제한 (현재 unlimited 의심) — DB 비대화 방지
- XSS 방지 (노트 표시 시 sanitize)

---

## 종합

| # | 항목 | 심각도 | 작업량 |
|:-:|------|:------:|:------:|
| 1 | mockup 4페이지 "샘플 데이터" 배너 | Medium | 10분 |
| 2 | Cloudflare Stream 환경변수 빌드 검증 | Low | 5분 |
| 3 | Cloudflare Stream Signed URL 의도 확인 | Medium | 30분 (확인만) |
| 4 | 학생 노트 길이 제한·sanitize | Low | 30분 |

**Pack B (인강 UX) 묶음에 #1, #2 포함 권장. 30분 작업.**

**TODOS.md 의 인강·이수 P2/P3 작업은 본 점검 범위 밖** (장기 트랙).
