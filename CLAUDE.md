@AGENTS.md

# AcaMS — Claude 작업 가이드

> 프로젝트 소개·개발현황·API목록·DB스키마·시드계정·CLI명령 → **README.md**
> 현재: **Phase C** — mock → 실제 DB API 교체 중 (학생→반→출결→재무→소통→캘린더 순)

---

## 절대 규칙

### Prisma 7
```typescript
// ✅ adapter 필수, /client 명시
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
```
- datasource URL → `prisma.config.ts` (schema.prisma 아님)
- 스키마 변경 후 `npx prisma generate` 필수

### Next.js 16
```typescript
export async function proxy(req: NextRequest) { ... }   // 미들웨어: src/proxy.ts
const cookieStore = await cookies();                    // cookies/headers: 반드시 await
const { id } = await ctx.params;                        // Route params: 반드시 async
requestHeaders.set('x-user-name', encodeURIComponent(name)); // 헤더 한글: URL인코딩
```

### 멀티테넌트 & 보안
```typescript
const academyId = req.headers.get('x-academy-id'); // body/query 값 절대 신뢰 금지
if (req.headers.get('x-user-role') !== 'super_admin') return 403;
```

### 하지 말 것
- `src/lib/mock/` 에 신규 데이터 추가 금지 — 신규 기능은 바로 DB API로
- 클라이언트 컴포넌트에서 `prisma` 직접 사용 금지

---

## 장기 제약 (기획서 v1.5)

| 항목 | 내용 |
|------|------|
| 동영상 시청 | 태블릿 전용 + 학생 인증 필수 |
| 출결 오프라인 | 로컬 500건 저장 → 재연결 시 자동 동기화 |
| 출결 동시 편집 | 잠금 메커니즘, 5분 자동 해제 |
| 알림 | 카카오 알림톡 우선, 3회 재시도 후 SMS 폴백 |
| 로그인 잠금 | 5회 실패 → 30분 잠금 |
| 데이터 보존 | 탈퇴 학생 3년 후 익명화, 휴학생 1년 후 자동 탈퇴 전환 |

---

## 핵심 파일

| 파일 | 역할 |
|------|------|
| `src/proxy.ts` | JWT 검증, 헤더 주입, 역할 접근 제어 |
| `src/lib/db/prisma.ts` | Prisma 싱글턴 |
| `src/lib/auth/jwt.ts` | signToken / verifyToken |
| `src/lib/auth/cookies.ts` | setAuthCookie / clearAuthCookie / getAuthToken (모두 async) |
| `src/lib/stores/authStore.ts` | 현재 유저 상태, hydrate(), logout() |
| `prisma/schema.prisma` | 전체 DB 스키마 (26개 모델) |
| `prisma.config.ts` | Prisma 7 설정 |

---

## 공용 컴포넌트 (`src/components/shared/`)

이미 구현된 것만 사용 — 중복 구현 금지:
- `Button` — variant: default/dark/primary/danger/ghost · size: sm/md/lg
- `Modal` · `Badge` · `Avatar` · `SearchInput` · `Tabs` · `ToastContainer`

```typescript
import { toast } from '@/lib/stores/toastStore';
toast('메시지', 'success'); // 'success' | 'error' | 'info'
```

---

## 디자인 토큰

```
primary bg: #1a2535  accent: #4fc3a1    border: #e2e8f0
text: #111827        text-muted: #6b7280  faint: #9ca3af
radius: card 12px / input 10px / btn 8px
font-size: 13px   header: 50px
```

---

## 작업 지침 (토큰 절약)

- **파일 읽기 전 수정 금지** — 반드시 Read 후 Edit
- **단일 도메인 집중** — 한 번에 한 API 라우트 + 해당 스토어만 수정
- **타입 재사용** — `src/lib/types/`에 있는 타입 먼저 확인 후 신규 정의
- **mock 파일 참고용** — 필드 구조 파악에만 사용, 수정 금지
- **Zustand 패턴** — 기존 store(예: `gradeStore.ts`) 참고해서 동일 패턴 유지
