@AGENTS.md

# AcaMS — Claude 작업 가이드

> 이 문서는 **길잡이(약도)**입니다. 사용자 질문이 들어오면 먼저 §1 도메인 인덱스에서 도메인 1행을 찾아 수정 대상 파일을 즉시 결정하세요.
> 프로젝트 소개·시드계정·환경변수·26개 모델 상세·Phase 진행·Breaking Changes → **README.md**

---

## §1. 도메인 인덱스 (질문 → 파일 매핑)

| 도메인 | UI 페이지 (`src/app/`) | API 라우트 (`src/app/api/`) | Store (`src/lib/stores/`) | Type (`src/lib/types/`) | Prisma 모델 |
|--------|-----------------------|-----------------------------|---------------------------|-------------------------|-------------|
| 학생 | `(admin)/students/*` (목록·출결·성적·리포트) | `students/`, `students/[id]/` | `studentStore.ts` | `student.ts` | Student, Parent, StudentParent, StudentSibling |
| 반 | `(admin)/classes/*` (목록·커리큘럼·보강·강사) | `classes/`, `classes/[id]/`, `teachers/`, `teachers/[id]/`, `makeup/`, `makeup/[id]/` | `classStore.ts`, `teacherStore.ts`, `makeupStore.ts` | `class.ts`, `teacher.ts` | Class, ClassTeacher, ClassEnrollment, ClassSchedule, MakeupClass, MakeupClassTarget, Teacher |
| 출결 | `(admin)/classes/attendance`, `(admin)/students/attendance` | `attendance/`, `attendance/[id]/` | `attendanceStore.ts` | `attendance.ts` | AttendanceRecord |
| 성적 | `(admin)/students/grades` | `exams/`, `exams/[id]/`, `grades/`, `grades/[id]/` | `gradeStore.ts` | `grade.ts` | Exam, GradeRecord |
| 재무 | `(admin)/finance/*` (billing·payments·receipts·overdue·settlement) | `finance/bills/`, `finance/bills/[id]/pay/`, `finance/expenses/`, `finance/receipts/` | `financeStore.ts` | `finance.ts` | Bill, Receipt, Expense |
| 소통 | `(admin)/communication/*` (announcements·consultation·notifications) | `communication/announcements/` (GET·POST, classId 지원) | `communicationStore.ts` | `notification.ts` | Notification, NotificationRecipient, ConsultationRecord, Announcement |
| 캘린더 | `(admin)/calendar` | `calendar/`, `calendar/[id]/` (classId 지원) | `calendarStore.ts` | — | CalendarEvent |
| 모바일 PWA | `mobile/*` (grades·announcements·calendar·attendance·schedule·payments·profile) | `mobile/grades/`, `mobile/announcements/`, `mobile/calendar/` | — | — | Student, Parent, ClassEnrollment, GradeRecord, Exam, Announcement, CalendarEvent |
| 키오스크 | `kiosk/` (QR/수동 학번) | **미구현** | `classStore` 일부 | — | (AttendanceRecord 예정) |
| 슈퍼어드민 | `super-admin/*` (학원 목록·상세·신규) | `super-admin/academies/`, `.../[id]/`, `.../[id]/users/[userId]/`, `super-admin/profile/password/` | — | — | Academy, User |
| 인증 | `login/`, `src/proxy.ts` | `auth/login/`, `auth/logout/`, `auth/me/` | `authStore.ts` | — | User |

**활용 규칙**
- 도메인 키워드 → 1행 → 5개 후보 파일 결정 → 추가 Glob 없이 바로 Read
- UI 수정 = `UI 페이지` / 데이터 흐름 = `API 라우트 + Store` / 스키마 변경 = `Prisma 모델` (`prisma/schema.prisma`)

---

## §2. 역할별 진입점 (proxy 접근 제어)

```
super_admin       → /super-admin/*
director, teacher → /(admin)/*
parent, student   → /mobile/*
미인증            → /login, /kiosk
```

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
const academyId = req.headers.get('x-academy-id'); // body/query 값 절대 신뢰 금지
if (req.headers.get('x-user-role') !== 'super_admin') return 403;
```

### 금지
- `src/lib/mock/`에 신규 데이터 추가 — 신규 기능은 바로 DB API로
- 클라이언트 컴포넌트에서 `prisma` 직접 사용

---

## §4. 공용 자원

- 컴포넌트 (`src/components/shared/`): `Button` (variant: default/dark/primary/danger/ghost · size: sm/md/lg) · `Modal` · `Badge` · `Avatar` · `SearchInput` · `FilterTags` · `Tabs` · `ToastContainer` — **중복 구현 금지**
- 토스트: `import { toast } from '@/lib/stores/toastStore'; toast(msg, 'success'|'error'|'info')`
- 디자인 토큰: primary `#1a2535` · accent `#4fc3a1` · border `#e2e8f0` · text `#111827` / muted `#6b7280` / faint `#9ca3af` · radius card 12 / input 10 / btn 8 · 기본 13px · header 50px

---

---

## §6. Mobile PWA (학부모·학생)

### 라우트 및 API
- UI: `src/app/mobile/*` — 5탭 (홈·출결·성적·공지·내정보), 캘린더·일정·결제 탭 포함
- API: `src/app/api/mobile/` — grades · announcements · calendar (3개)
- 레이아웃: `src/app/mobile/layout.tsx` — manifest·SW·ToastContainer 포함
- 서비스 워커: `public/sw.js`, 등록: `src/components/mobile/SwRegister.tsx`
- PWA manifest: `public/manifest.json` (start_url=/mobile, scope=/mobile)

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

## §5. 작업 지침 (토큰 절약)

- **Read 후에만 Edit** — 미열람 파일 수정 금지
- **단일 도메인 집중** — 한 번에 §1의 1행만
- **타입 재사용** — `src/lib/types/` 먼저 확인 후 신규 정의
- **mock 파일은 참고용** — 필드 구조 파악만, 수정 금지
- **Zustand 패턴** — 기존 store(예: `gradeStore.ts`) 그대로 따라가기
- **상세는 README** — 시드계정·Phase·26개 모델 풀 스펙·Prisma/Next.js Breaking Changes 전체 코드 예시는 `README.md`에서 찾기
