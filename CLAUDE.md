@AGENTS.md

# AcaMS — Claude 작업 가이드

> 이 문서는 **길잡이(약도)**입니다. 사용자 질문이 들어오면 먼저 §1 도메인 인덱스에서 도메인 1행을 찾아 수정 대상 파일을 즉시 결정하세요.
> 프로젝트 소개·시드계정·환경변수·31개 모델 상세·Phase 진행·Breaking Changes → **README.md**

---

## §1. 도메인 인덱스 (질문 → 파일 매핑)

| 도메인 | UI 페이지 (`src/app/`) | API 라우트 (`src/app/api/`) | Store (`src/lib/stores/`) | Type (`src/lib/types/`) | Prisma 모델 |
|--------|-----------------------|-----------------------------|---------------------------|-------------------------|-------------|
| 학생 | `(admin)/students/*` (목록·출결·수업이력, 상세 모달 탭: 정보/반/출결/성적/수납/상담) | `students/`, `students/[id]/`, `students/[id]/reset-password/` | `studentStore.ts` | `student.ts` | Student, Parent, StudentParent, StudentSibling |
| 반 | `(admin)/classes/*` (목록·커리큘럼·보강·강사) | `classes/`, `classes/[id]/`, `classes/[id]/curriculum/`, `classes/[id]/textbooks/`, `teachers/`, `teachers/[id]/`, `teachers/[id]/reset-password/`, `makeup/`, `makeup/[id]/` | `classStore.ts`, `teacherStore.ts`, `makeupStore.ts` | `class.ts`, `teacher.ts` | Class, ClassTeacher, ClassEnrollment, ClassSchedule, MakeupClass, MakeupClassTarget, Teacher, CurriculumRow, Textbook |
| 출결 | `(admin)/classes/attendance`, `(admin)/students/attendance` | `attendance/`, `attendance/[id]/` | `attendanceStore.ts` | `attendance.ts` | AttendanceRecord |
| 성적 | `(admin)/students` 상세 모달 성적 탭 (`students/_tabs/GradeTab.tsx`) | `exams/`, `exams/[id]/`, `grades/`, `grades/[id]/` | `gradeStore.ts` | `grade.ts` | Exam, GradeRecord |
| 재무 | `(admin)/finance/*` (billing·payments·receipts·overdue·settlement) | `finance/bills/`, `finance/bills/[id]/pay/`, `finance/expenses/`, `finance/receipts/` | `financeStore.ts` | `finance.ts` | Bill, Receipt, Expense |
| 소통 | `(admin)/communication/*` (announcements·consultation·notifications) | `communication/announcements/`, `communication/consultations/`, `communication/consultations/[id]/`, `communication/notifications/`, `communication/inquiries/`, `communication/inquiries/[id]/`, `communication/notification-templates/` | `communicationStore.ts` | `notification.ts` | Notification, NotificationRecipient, NotificationTemplate, ConsultationRecord, Announcement, PublicInquiry |
| 캘린더 | `(admin)/calendar` | `calendar/`, `calendar/[id]/` (classId 지원) | `calendarStore.ts` | — | CalendarEvent |
| 통계 | `(admin)/analytics` | `analytics/monthly/` | — | — | (집계 쿼리, 별도 모델 없음) |
| 인강 | `ingang/*` (lectures·lectures/new·lectures/tags·lectures/targets·exams·completion·completion/lectures·completion/students) | `lectures/`, `lectures/[id]/`, `lectures/tags/`, `lectures/tags/[id]/`, `lectures/upload-url/`, `lecture-series/`, `lecture-series/[id]/` | — | — | Lecture, LectureTarget, AcademyTag, LectureSeries |
| 과제 | `(admin)/classes/lessons` | `assignments/`, `assignments/[id]/` | — | — | Assignment |
| 수업이력 | `(admin)/classes/lessons` | `lessons/comments/`, `lessons/clinic-templates/`, `lessons/clinic-templates/[id]/`, `lessons/clinic-results/` | — | — | LessonComment, ClinicTemplate, ClinicResult |
| 리포트 | `(admin)/classes/lessons` (리포트 발행) | `reports/`, `reports/[id]/`, `reports/publish/`, `reports/publish-periodic/`, `reports/batches/`, `report-templates/`, `report-templates/[id]/` | — | — | Report, ReportTemplate |
| 반 이벤트 | `(admin)/calendar` | `class-events/`, `class-events/[id]/` | — | — | ClassEvent |
| 모바일 PWA | `mobile/*` (홈·grades·announcements·calendar·attendance·schedule·payments·notifications·profile) | `mobile/me/`, `mobile/children/`, `mobile/grades/`, `mobile/announcements/`, `mobile/calendar/`, `mobile/attendance/`, `mobile/makeup/`, `mobile/notifications/`, `mobile/reports/`, `mobile/push/` (schedule 페이지는 `mobile/me` 사용, 별도 API 없음) | — | — | Student, Parent, ClassEnrollment, GradeRecord, Exam, Announcement, CalendarEvent |
| 모바일 결제 | `mobile/payments/*` (목록·success·fail) | `mobile/payments/`, `mobile/payments/order/`, `mobile/payments/toss-client-key/`, `mobile/payments/toss/confirm/` | — | — | Bill, Receipt, PaymentOrder |
| 키오스크 | `kiosk/` (QR/수동 학번) | `kiosk/session/`, `kiosk/recent/`, `kiosk/check-in/` (인증 불필요) | `classStore` 일부 | — | AttendanceRecord |
| 슈퍼어드민 | `super-admin/*` (학원 목록·상세·신규) | `super-admin/academies/`, `.../[id]/`, `.../[id]/users/[userId]/`, `.../[id]/toss-key/`, `super-admin/profile/password/` | — | — | Academy, User |
| 인증 | `login/`, `src/proxy.ts` | `auth/login/`, `auth/logout/`, `auth/me/` | `authStore.ts` | — | User |
| 학원 공개 페이지 | `academy/[slug]/` (공개, 인증불필요) | `api/academy/[slug]/` (GET, 공개) · `api/academy/[slug]/inquiry/` (POST, 공개) · `api/settings/academy/` (GET·PATCH, 원장전용) · `api/settings/gallery/` (POST, 이미지 업로드) | — | — | Academy (공개프로필 필드), PublicInquiry |

**활용 규칙**
- 도메인 키워드 → 1행 → 5개 후보 파일 결정 → 추가 Glob 없이 바로 Read
- UI 수정 = `UI 페이지` / 데이터 흐름 = `API 라우트 + Store` / 스키마 변경 = `Prisma 모델` (`prisma/schema.prisma`)

---

## §2. 역할별 진입점 (proxy 접근 제어)

> 배포 URL: **https://acams-jmi3.vercel.app** | 로컬: http://localhost:3000

```
super_admin       → /super-admin/*
director, teacher → /(admin)/*, /ingang/*
parent, student   → /mobile/*
미인증            → /login, /kiosk
공개(인증무관)    → /academy/*, /api/academy/*, /api/kiosk/*
```

> 인강 메뉴는 GNB 탭(`/ingang/lectures` 진입)으로 분리. 사이드바는 보라색 테마(`#1e1b2e`)를 쓰는 `src/components/ingang/InGangSidebar.tsx`이고, 같은 페이지의 탭 구분은 `?tab=cond|retry|exam|cert` URL search param으로 처리.

### 강사 메뉴 권한 enforce
- `teacher` 역할은 `Teacher.permissions`(8키 boolean)로 페이지·API 접근 제어. `director`/`super_admin`은 전체 접근, `admin` 권한 강사도 전체 통과.
- **enforce 위치**: `src/proxy.ts`(edge) — 로그인 시 권한을 JWT에 임베드(`signToken`), `TEACHER_PAGE_RULES`/`TEACHER_API_RULES` 경로 접두사 맵으로 차단(UI는 첫 허용 페이지로 redirect, API는 403).
- **공유 읽기 예외**: `GET /api/classes`·`GET /api/students`는 모든 강사 허용(출결·수업 등 기초 조회 의존성). 생성/수정/삭제는 권한대로 차단.
- **권한 키 없는 경로**: `/calendar`·`/ingang`은 모든 강사 허용, `/settings`는 `admin` 권한 필요.
- **권한 변경 반영**: 원장이 권한 수정(`PATCH /api/teachers/[id]`) 시 해당 강사 `User.tokenVersion` 증가 → 기존 토큰 무효화 → 재로그인 후 새 권한 적용.
- 사이드바(`src/components/admin/Sidebar.tsx`)는 `/api/auth/me`의 permissions로 권한 없는 메뉴 숨김.

---

## §3. 절대 규칙

### Prisma 7
```typescript
import { PrismaClient } from '@/generated/prisma/client'; // /client 명시
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

### 멀티테넌트 보안
```typescript
// API 라우트 인증 — requireAuth가 academyId + validateSession(계정활성·토큰버전) 검사
import { requireAuth } from '@/lib/auth/requireAuth';
const auth = await requireAuth(req);
if (auth instanceof NextResponse) return auth;
const { academyId, userId, role } = auth; // body/query의 academyId 값은 절대 신뢰 금지
if (role !== 'super_admin') return 403;    // 역할 제한이 필요한 경우
```
- 공개 라우트(`/api/academy/*`, `/api/kiosk/*` 등)는 requireAuth 미적용

### 금지
- 목업/하드코딩 데이터로 신규 기능 구현 — 신규 기능은 바로 DB API로
- 클라이언트 컴포넌트에서 `prisma` 직접 사용

---

## §4. 공용 자원

- 컴포넌트 (`src/components/shared/`): `Button` (variant: default/dark/primary/danger/ghost · size: sm/md/lg) · `Modal` · `Badge` · `Avatar` · `SearchInput` · `FilterTags` · `Tabs` · `ToastContainer` — **중복 구현 금지**
- **브랜드 로고/아이콘**: `BrandMark`(HL 마크) · `Wordmark`(학원로그 텍스트). 규격·좌표·재생성은 **`DESIGN.md` §7 브랜드 마크**가 단일 출처. "로고 그려줘" 류 요청 → `src/components/shared/BrandMark.tsx` 좌표 그대로 따르고 색/형태 변경 금지. PNG는 `node scripts/gen-brand-icons.mjs`로 일괄 재생성.
- 토스트: `import { toast } from '@/lib/stores/toastStore'; toast(msg, 'success'|'error'|'info')`
- 디자인 토큰: primary `#1a2535` · accent `#4fc3a1` · border `#e2e8f0` · text `#111827` / muted `#6b7280` / faint `#9ca3af` · radius card 12 / input 10 / btn 8 · 기본 13px · header 50px

---

## §5. Mobile PWA (학부모·학생)

### 라우트 및 API
- UI: `src/app/mobile/*` — 5탭 (홈·출결·성적·공지·내정보), 캘린더·일정·결제·알림 탭 포함
- API: `src/app/api/mobile/` — me · children · grades · announcements · calendar · attendance · makeup · reports · notifications · push · payments/order · payments/toss-client-key · payments/toss/confirm (schedule 전용 API 없음 — 시간표는 `me` 응답 사용)
- 레이아웃: `src/app/mobile/layout.tsx` — manifest·SW·ToastContainer 포함
- 서비스 워커: `public/sw.js`, 등록: `src/components/mobile/SwRegister.tsx`
- PWA manifest: `public/manifest.json` (start_url=/mobile, scope=/mobile)

### 토스페이먼츠 결제 플로우
```
알림/수납 "결제하기" → POST /api/mobile/payments/order (billIds 검증·금액확인·PaymentOrder 생성)
  → GET /api/mobile/payments/toss-client-key (NEXT_PUBLIC_TOSS_CLIENT_KEY)
  → 토스 SDK requestPayment() → /mobile/payments/success?paymentKey=&orderId=&amount=
  → POST /api/mobile/payments/toss/confirm (Toss 승인 → Bill PAID + Receipt 생성)
실패 시 → /mobile/payments/fail
```
- 청구 알림 발송 시 `Notification.metadata = { billIds: string[] }` 저장
- 환경변수: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`

### 인증 패턴 (parent vs student 분기)
```typescript
const role = req.headers.get('x-user-role');  // 'parent' | 'student'
const userId = req.headers.get('x-user-id');
if (role === 'student') {
  const student = await prisma.student.findFirst({ where: { userId, academyId } });
} else if (role === 'parent') {
  const parent = await prisma.parent.findFirst({ where: { userId }, include: { children: { include: { student: true } } } });
}
```

### 반 필터 패턴 (핵심)
```typescript
// 학생의 활성 수강 반 목록
const enrollments = await prisma.classEnrollment.findMany({
  where: { studentId, isActive: true }, select: { classId: true },
});
const classIds = enrollments.map((e) => e.classId);

// 내 반 공지 + 전체 공지
prisma.announcement.findMany({
  where: { academyId, status: 'PUBLISHED', OR: [{ classId: null }, { classId: { in: classIds } }] },
});
// 내 반 일정 + 전체 공개 일정
prisma.calendarEvent.findMany({
  where: { academyId, OR: [{ isPublic: true }, { classId: { in: classIds } }] },
});
```

### 반 지정 공지·일정 등록 (관리자 API)
- `POST /api/communication/announcements` body에 `classId?: string` 포함 가능 (null=전체)
- `POST /api/calendar` body에 `classId?: string` 포함 가능 (null=전체)

---

## §6. 인강 (Phase F · DB 연동)

- 라우트: `src/app/ingang/*` — layout.tsx + InGangSidebar로 보라색 테마 단독 영역 구성
- 사이드바: `src/components/ingang/InGangSidebar.tsx` — `usePathname()` + `useSearchParams()`로 활성 메뉴 표시, **`<Suspense>`로 래핑 필수**
- 탭 분기: 같은 경로 + `?tab=` 패턴 (예: `/ingang/lectures/targets?tab=cond` ↔ `?tab=retry`) — `router.replace()`로 URL 동기화
- **DB 연동 완료**: lectures 목록·등록·태그·수강대상(강의 목록) → `/api/lectures/*` (x-academy-id 필수)
- **커스텀 태그**: 기본 태그는 프론트 하드코딩(모든 학원 공통), 학원별 추가 태그는 `AcademyTag` 모델 → `GET/POST/DELETE /api/lectures/tags/`
- **영상 업로드**: `tus-js-client`(동적 import) + Cloudflare Stream Direct Creator Upload → `POST /api/lectures/upload-url` → `{ uploadURL, uid }` → TUS 업로드 → `cfVideoId` 저장
  - 재생: `https://iframe.videodelivery.net/{cfVideoId}` (iframe)
  - 환경변수 필요: `CF_ACCOUNT_ID`, `CF_STREAM_API_TOKEN`
- **미구현(목업) 영역**: exams·completion/lectures·completion/students — 페이지 내 하드코딩 데이터, DB 연동 미구현 (completion 루트 페이지는 DB 연동 완료)
- 디자인 토큰 (인강 전용): bg `#1e1b2e` · accent `#a78bfa` · sub-accent `#5B4FBE` · highlight `#EEEDFE`
- 진입: GNB의 "인강" 링크(`src/components/admin/GNB.tsx`) → `/ingang/lectures` 리다이렉트

---

## §7. 마케팅 페이지 (`/intro`)

- 공개 마케팅 라우트 `/intro` — 신규 학원 원장 유치용 전환 자산. 디자인 시스템 전체는 **`DESIGN.md`** 참조.
- 미학: Refined Minimal (Toss-clean). 제품 `globals.css` 토큰 상속(teal/navy), **인강 보라는 인강 섹션에만 한정**.
- 메시지 위계: 1차=통합/잔업 소멸(teal·navy), 2차=인강 수익(보라). 기능 7종은 "없애주는 잔업" 중심.
- 제약: "영국책방" 등 특정 학원명·실데이터 금지(더미만), 브랜드명 "학원로그", 1차 CTA=카톡 채널.
- proxy: `src/proxy.ts` `PUBLIC_PATHS`에 `/intro` 추가(범위 좁게). SEO: SSG/SSR + metadata + sitemap/robots.

---

## §8. 작업 지침 (토큰 절약)

- **Read 후에만 Edit** — 미열람 파일 수정 금지
- **단일 도메인 집중** — 한 번에 §1의 1행만
- **타입 재사용** — `src/lib/types/` 먼저 확인 후 신규 정의
- **Zustand 패턴** — 기존 store(예: `gradeStore.ts`) 그대로 따라가기
- **상세는 README** — 시드계정·Phase·31개 모델 풀 스펙·Prisma/Next.js Breaking Changes 전체 코드 예시는 `README.md`에서 찾기
