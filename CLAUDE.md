@AGENTS.md

# AcaMS — Claude 작업 가이드

## 프로젝트 성격
학원 관리 SaaS (멀티테넌트). 슈퍼어드민(나) → 원장 → 강사/학부모/학생 역할 계층.
현재 MVP 단계: 인증·DB 연동 완료, 도메인 API는 아직 mock 데이터 사용 중.

## 현재 상태 요약
- **인증**: JWT(httpOnly 쿠키) + bcrypt. `src/proxy.ts`에서 역할별 접근 제어.
- **DB**: Neon PostgreSQL + Prisma 7. `src/lib/db/prisma.ts` 싱글턴.
- **데이터 — DB 연동 완료**: 슈퍼어드민(학원/계정), 성적/시험(`/api/exams`, `/api/grades`).
- **데이터 — mock 사용 중**: 학생, 반, 출결, 재무, 소통, 캘린더 (`src/lib/mock/*.ts`).
- **다음 작업**: mock → 실제 API 교체 (학생 → 반 → 출결 → 재무 → 소통 → 캘린더 순서).

## 절대 지켜야 할 규칙

### Prisma 7
```typescript
// import 경로: @/generated/prisma/client (끝에 /client 필수)
import { PrismaClient } from '@/generated/prisma/client';
// PrismaClient 생성 시 adapter 필수
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
```
- seed.ts에서도 동일하게 adapter 방식 사용
- `prisma.config.ts`에 datasource URL과 seed 커맨드 설정됨

### Next.js 16
```typescript
// 미들웨어: proxy.ts, 함수명 proxy()
export async function proxy(req: NextRequest) { ... }

// cookies/headers: 항상 await
const cookieStore = await cookies();

// Route params: 항상 async
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
}

// HTTP 헤더에 한글 넣을 때: encodeURIComponent 필수
requestHeaders.set('x-user-name', encodeURIComponent(name));
```

### 멀티테넌트 데이터 격리
```typescript
// API 라우트에서 academyId는 반드시 헤더에서 가져올 것
const academyId = req.headers.get('x-academy-id'); // proxy가 JWT에서 주입
// 절대 클라이언트 요청 body/query의 academyId를 신뢰하지 말 것
```

### 슈퍼어드민 API 보호
```typescript
function isSuperAdmin(req: NextRequest) {
  return req.headers.get('x-user-role') === 'super_admin';
}
```

## 핵심 파일 위치

| 파일 | 역할 |
|------|------|
| `src/proxy.ts` | JWT 검증, 헤더 주입, 역할 접근 제어 |
| `src/lib/db/prisma.ts` | Prisma 싱글턴 (PrismaPg 어댑터) |
| `src/lib/auth/jwt.ts` | signToken / verifyToken |
| `src/lib/auth/cookies.ts` | setAuthCookie / clearAuthCookie / getAuthToken (모두 async) |
| `src/lib/stores/authStore.ts` | 현재 유저 상태, hydrate(), logout() |
| `prisma/schema.prisma` | 전체 DB 스키마 |
| `prisma/seed.ts` | 테스트 데이터 (tsx로 실행) |
| `prisma.config.ts` | Prisma 7 설정 |

## 공용 컴포넌트

`src/components/shared/`에 이미 구현된 것들:
- `Button` — variant: default/dark/primary/danger/ghost, size: sm/md/lg
- `Modal` — title, children, footer props
- `Badge` — 상태 표시용
- `Avatar` — 이니셜 + 색상
- `SearchInput` — 검색창
- `Tabs` — 탭 네비게이션
- `ToastContainer` — 반드시 layout.tsx에 포함

Toast 사용:
```typescript
import { toast } from '@/lib/stores/toastStore';
toast('메시지', 'success'); // 'success' | 'error' | 'info'
```

## 디자인 토큰

```
primary bg:    #1a2535 (다크 네이비)
accent:        #4fc3a1 (민트 그린)
border:        #e2e8f0
text-primary:  #111827
text-muted:    #6b7280
text-faint:    #9ca3af
radius-card:   12px
radius-input:  10px
radius-btn:    8px
font-size 기본: 13px
header height: 50px
```

## 개발 서버 / 빌드

```bash
npm run dev    # localhost:3000 (Turbopack)
npm run build  # 타입 에러 확인용으로 자주 실행
```

시드 재실행:
```bash
npx prisma db seed
```

스키마 변경 후:
```bash
npx prisma db push    # 개발 중
npx prisma generate   # 클라이언트 재생성
```
