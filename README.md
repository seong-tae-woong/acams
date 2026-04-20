# AcaMS — 학원 관리 시스템

학원 운영에 필요한 학생 관리, 출결, 성적, 재무, 소통 기능을 제공하는 멀티테넌트 SaaS.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.2 (App Router, Turbopack) |
| 언어 | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 |
| 상태 관리 | Zustand v5 |
| DB | PostgreSQL (Neon 서버리스) |
| ORM | Prisma v7.7 + @prisma/adapter-pg |
| 인증 | JWT (jose + jsonwebtoken) + bcrypt |
| 배포 | Vercel (프론트 + API) + Neon (DB) |

---

## 환경 변수

`.env` 파일 (절대 커밋 금지):

```env
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
JWT_SECRET=<64자 이상 랜덤 문자열>
JWT_EXPIRES_IN=7d
```

Vercel 환경 변수(Settings → Environment Variables)에도 동일하게 등록.

---

## 로컬 실행

```bash
npm install
npx prisma generate       # Prisma 클라이언트 생성 (src/generated/prisma/)
npx prisma db push        # DB 스키마 적용
npx prisma db seed        # 테스트 데이터 삽입
npm run dev               # http://localhost:3000
```

### 시드 계정

| 역할 | 이메일 | 초기 비밀번호 |
|------|--------|-------------|
| 슈퍼어드민 | superadmin@acams.kr | acams2026! |
| 원장 | director@segyero.kr | segyero2026! |
| 강사 | kim@segyero.kr | teacher2026! |

> **주의**: 배포 후 슈퍼어드민 비밀번호 반드시 변경 (우측 상단 "비밀번호 변경").

---

## 프로젝트 구조

```
acams/
├── prisma/
│   ├── schema.prisma        # DB 스키마 (26개 모델)
│   └── seed.ts              # 테스트 데이터 스크립트
├── prisma.config.ts         # Prisma 7 설정 (datasource URL, seed 커맨드)
├── src/
│   ├── proxy.ts             # Next.js 16 미들웨어 (JWT 검증, 역할 접근 제어)
│   ├── generated/prisma/    # Prisma 생성 클라이언트 (git 제외, generate로 생성)
│   ├── app/
│   │   ├── page.tsx         # 루트 → 역할별 리다이렉트
│   │   ├── login/           # 로그인 페이지
│   │   ├── (admin)/         # 원장·강사 영역 (GNB + 사이드바 레이아웃)
│   │   │   ├── students/    # 학생 관리 (등록, 출결, 성적, 리포트)
│   │   │   ├── classes/     # 반 관리 (시간표, 출결체크, 커리큘럼, 보강, 강사)
│   │   │   ├── finance/     # 재무 (청구, 수납, 미납, 정산, 영수증)
│   │   │   ├── calendar/    # 캘린더 (학원 일정, 상담 일정)
│   │   │   ├── communication/ # 소통 (공지, 상담, 알림)
│   │   │   ├── analytics/   # 통계 분석
│   │   │   └── settings/    # 계정 관리
│   │   ├── mobile/          # 학부모·학생 PWA
│   │   ├── kiosk/           # QR 출석 체크인 키오스크
│   │   ├── super-admin/     # 슈퍼어드민 학원 관리
│   │   └── api/             # API 라우트
│   ├── components/
│   │   ├── admin/           # GNB, Sidebar, Topbar
│   │   ├── mobile/          # BottomTabBar
│   │   └── shared/          # Button, Modal, Badge, Avatar 등 공용 컴포넌트
│   └── lib/
│       ├── auth/            # jwt.ts, cookies.ts
│       ├── db/prisma.ts     # Prisma 싱글턴 (PrismaPg 어댑터)
│       ├── mock/            # 더미 데이터 (DB 교체 전까지 사용 중)
│       ├── stores/          # Zustand 스토어 10개
│       └── types/           # TypeScript 타입 정의
```

---

## 인증 흐름

```
[브라우저] POST /api/auth/login
    → bcrypt 비교 → JWT 발급 → httpOnly 쿠키(acams_token, 7일) 설정

[모든 요청] src/proxy.ts
    → 쿠키에서 JWT 추출 → jose로 검증
    → 헤더 주입: x-user-id, x-user-role, x-academy-id, x-user-name(URL인코딩)
    → 역할별 접근 제어
```

### 역할별 접근 경로

| 역할 | 접근 가능 경로 |
|------|--------------|
| super_admin | /super-admin/* |
| director / teacher | /(admin)/* |
| parent / student | /mobile/* |
| 미인증 | /login, /kiosk |

---

## DB 스키마 주요 모델 (26개)

```
Academy             학원 (테넌트 단위)
User                계정 (super_admin / director / teacher / parent / student)
Student             학생 (StudentStatus: ACTIVE/ON_LEAVE/WITHDRAWN/WAITING)
StudentSibling      형제·자매 관계
Parent              보호자
StudentParent       학생-보호자 연결
Teacher             강사 (permissions JSON 포함)
Class               반
ClassTeacher        반-강사 배정
ClassEnrollment     수강 등록 (학생 ↔ 반)
ClassSchedule       수업 일정 (요일·시간)
AttendanceRecord    출결 기록 (PRESENT/ABSENT/LATE/EARLY_LEAVE)
MakeupClass         보강 수업
MakeupClassTarget   보강 대상 학생
Exam / GradeRecord  시험·성적
Bill / Receipt      청구서·영수증 (PAID/UNPAID/PARTIAL)
Expense             지출
Notification        알림
NotificationRecipient  알림 수신자
ConsultationRecord  상담 기록
Announcement        공지사항 (DRAFT/PUBLISHED)
CalendarEvent       캘린더 일정
```

모든 도메인 모델은 `academyId` FK 포함 → 학원별 데이터 격리.
API에서 `academyId`는 반드시 `req.headers.get('x-academy-id')`로 가져올 것.

---

## API 라우트 목록

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/login | 이메일+비밀번호 로그인 |
| POST | /api/auth/logout | 쿠키 삭제 |
| GET | /api/auth/me | 현재 사용자 정보 |

### 슈퍼어드민 (x-user-role: super_admin 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/super-admin/academies | 전체 학원 목록 |
| POST | /api/super-admin/academies | 학원 + 원장 계정 생성 |
| GET | /api/super-admin/academies/[id] | 학원 상세 (유저 목록 포함) |
| PATCH | /api/super-admin/academies/[id] | 학원 정보 수정 |
| PATCH | /api/super-admin/academies/[id]/users/[userId] | 계정 활성/비활성, 비밀번호 초기화 |
| PATCH | /api/super-admin/profile/password | 슈퍼어드민 본인 비밀번호 변경 |

### 성적/시험 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/exams?classId= | 반별 시험 목록 |
| POST | /api/exams | 시험 등록 |
| DELETE | /api/exams/[id] | 시험 삭제 (연결된 성적 포함) |
| GET | /api/grades?examId= | 시험별 성적 목록 |
| POST | /api/grades | 성적 레코드 일괄 upsert |
| PATCH | /api/grades/[id] | 점수·순위·코멘트 수정 |

---

## 개발 현황

### 완료 (Phase A ~ B)
- [x] 전체 UI 프로토타입 (모든 페이지 레이아웃 + mock 데이터)
- [x] JWT 인증 + httpOnly 쿠키
- [x] Next.js 16 proxy (역할별 접근 제어, 헤더 주입)
- [x] Prisma 7 + PostgreSQL (Neon) 연동
- [x] DB 시드 데이터 (학원 1개, 학생 20명, 반 5개, 강사 3명)
- [x] 슈퍼어드민: 학원 목록, 등록, 상세, 계정 관리, 비밀번호 변경
- [x] Toast 알림 시스템
- [x] 학생 등록 모달 + 생년월일 필드
- [x] 출결번호 연도+순번 형식 (예: 2026001)
- [x] 형제/자매 자동 감지 (보호자 번호 일치 시 연결 제안)
- [x] 학부모 앱 계정 초기 정보 안내 (등록 완료 시 ID/PW 규칙 표시)
- [x] 성적/시험 DB 연동 — `/api/exams` (GET·POST·DELETE), `/api/grades` (GET·POST·PATCH)

### 완료 (Phase C 진행 중)
- [x] **반 관리 UI 고도화**: 반 CRUD (추가·수정·삭제), 월별 캘린더 시간표, 학생 수강 등록/해제
- [x] **커리큘럼 관리**: 주차별 커리큘럼 편집 UI
- [x] **보강 관리**: 보강 일정 생성·관리 UI, makeupStore 추가
- [x] **강사 관리 탭**: 반별 강사 배정 UI, teacherStore 추가
- [x] 출결 현황 페이지 개선 (학생별 출결 요약)
- [x] 학생 리포트 페이지 개선

### 다음 작업 — Phase C: Mock → 실제 API 교체

현재 원장 도메인 데이터(학생, 반, 출결, 재무, 소통)는 `src/lib/mock/*.ts` 더미 데이터를 Zustand 스토어에 올려 사용 중. 실제 DB API로 교체 필요.

| 순서 | 도메인 | API 라우트 (신규 생성) | 스토어 (수정) |
|------|--------|----------------------|-------------|
| 1 | 학생 | /api/students, /api/students/[id] | studentStore.ts |
| 2 | 반 | /api/classes, /api/classes/[id] | classStore.ts |
| 3 | 출결 | /api/attendance | attendanceStore.ts |
| 4 | 재무 | /api/bills, /api/expenses, /api/receipts | financeStore.ts |
| ~~5~~ | ~~성적~~ | ~~/api/exams, /api/grades~~ | ~~완료~~ |
| 5 | 소통 | /api/notifications, /api/consultations, /api/announcements | communicationStore.ts |
| 6 | 캘린더 | /api/calendar | mock 직접 제거 |

**API 라우트 작성 패턴:**
```typescript
// src/app/api/students/route.ts
export async function GET(req: NextRequest) {
  const academyId = req.headers.get('x-academy-id'); // proxy가 주입
  if (!academyId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const students = await prisma.student.findMany({ where: { academyId } });
  return NextResponse.json(students);
}
```

### 미구현 (향후)

#### Phase D: 학부모/학생 모바일 앱 실제 연동
학생 도메인 API 전환(Phase C) 완료 후 진행.

**계정 생성 및 관리** — 학생 등록 API(`POST /api/students`) 구현 시 함께 처리:

| 항목 | 내용 |
|------|------|
| 로그인 ID | 보호자 전화번호 (User.email 필드에 저장) |
| 초기 비밀번호 | 학생 생년월일 8자리 YYYYMMDD → bcrypt 해시 |
| 역할 | `UserRole.parent` (보호자), `UserRole.student` (학생 — 선택적) |
| 중복 처리 | 같은 전화번호 User가 이미 존재하면 신규 생성 없이 StudentParent만 연결 |
| 형제/자매 | 같은 User가 여러 Student와 연결 → 앱에서 자녀 전환 기능 필요 |

**모바일 앱 실제 데이터 연동** — 현재 `src/app/mobile/`의 모든 페이지가 `STUDENT_ID = 's1'`로 하드코딩됨:
- 로그인 후 JWT의 `userId`로 `Student` 또는 `Parent` 프로필 조회
- 보호자 계정: 연결된 자녀 목록 조회 → 자녀 전환 UI 제공

**원장 PW 관리** — 학생 상세 화면에 "앱 계정" 섹션 추가:
- `PW 초기화` 버튼 → `PATCH /api/students/[id]/reset-password` → 생년월일로 재설정

#### 기타
- [ ] 키오스크 QR 출석 체크인 로직
- [ ] 알림 실제 발송 (카카오 알림톡 or SMS)
- [ ] 정산서 PDF 출력
- [ ] NestJS 백엔드 마이그레이션 (장기 계획)

---

## Prisma 7 Breaking Changes

```typescript
// ❌ 기존 방식 (Prisma 5 이하)
import { PrismaClient } from '@prisma/client';

// ✅ Prisma 7 방식 (driver adapter 필수)
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client'; // /client 명시 필수
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
```

- `generator` 이름: `prisma-client` (구: `prisma-client-js`)
- 클라이언트 생성 경로: `src/generated/prisma/` → import 시 `/client` 까지 명시
- datasource URL: schema.prisma가 아닌 `prisma.config.ts`에서 관리

## Next.js 16 Breaking Changes

```typescript
// 미들웨어 파일명: middleware.ts → proxy.ts, 함수명: proxy()
export async function proxy(req: NextRequest) { ... }

// cookies(), headers() 전부 async
const cookieStore = await cookies();

// Route params도 async
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
}
```
