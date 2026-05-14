# AcaMS — 학원 관리 시스템

학원 운영에 필요한 학생 관리, 출결, 성적, 재무, 소통, 인강 기능을 제공하는 멀티테넌트 SaaS.

---

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router, Turbopack) | 16.2.4 |
| 언어 | TypeScript | 5.x |
| UI | React + Tailwind CSS | 19.2.4 / v4 |
| 상태 관리 | Zustand | v5 |
| DB | PostgreSQL (Neon 서버리스) | — |
| ORM | Prisma + @prisma/adapter-pg | v7.7 |
| 인증 | JWT (jose) + bcryptjs | — |
| 결제 | 토스페이먼츠 SDK | 2.7.0 |
| 영상 | Cloudflare Stream + tus-js-client | — |
| 스토리지 | Vercel Blob | v2.3.3 |
| QR | qrcode, html5-qrcode | 1.5.4, 2.3.8 |
| 차트 | Recharts | 3.8.1 |
| 아이콘 | lucide-react | 1.8.0 |
| 배포 | Vercel | — |

---

## 배포 환경

| 구분 | URL |
|------|-----|
| 프로덕션 | https://acams-jmi3.vercel.app |
| DB | Neon PostgreSQL (ap-southeast-1, connection pooling 활성화) |
| GitHub | https://github.com/seong-tae-woong/acams |

---

## 환경 변수

`.env` 파일 (절대 커밋 금지):

```env
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
JWT_SECRET=<64자 이상 랜덤 문자열>
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_TOSS_CLIENT_KEY=<토스페이먼츠 클라이언트 키>
TOSS_SECRET_KEY=<토스페이먼츠 시크릿 키>
BLOB_READ_WRITE_TOKEN=<Vercel Blob 토큰>
CF_ACCOUNT_ID=<Cloudflare 계정 ID>
CF_STREAM_API_TOKEN=<Cloudflare Stream API 토큰>
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

### 빌드

```bash
npm run build    # prisma generate + next build
npm start        # 프로덕션 서버
```

### 시드 계정

| 역할 | 이메일/ID | 초기 비밀번호 | 비고 |
|------|-----------|-------------|------|
| 슈퍼어드민 | superadmin@acams.kr | acams2026! | 배포 후 반드시 변경 |
| 원장 | director@segyero.kr | segyero2026! | 세계로 영어학원 |
| 강사 | kim@segyero.kr | teacher2026! | 제한된 권한 |
| 학생 (20명) | SGR1001 ~ SGR1020 | SeedSt24 | `출석번호 = 학원키 + 연도순번` |
| 학부모 (20명) | 010-xxxx-xxxx (전화번호) | SeedPr24 | 학생 1인당 1보호자 |

---

## 프로젝트 구조

```
acams/
├── prisma/
│   ├── schema.prisma        # DB 스키마 (31개 모델)
│   └── seed.ts              # 테스트 데이터 스크립트
├── prisma.config.ts         # Prisma 7 설정 (datasource URL, seed 커맨드)
├── src/
│   ├── proxy.ts             # Next.js 16 미들웨어 (JWT 검증, 역할 접근 제어)
│   ├── generated/prisma/    # Prisma 생성 클라이언트 (git 제외, generate로 생성)
│   ├── app/
│   │   ├── page.tsx         # 루트 → 역할별 리다이렉트
│   │   ├── login/           # 로그인 페이지
│   │   ├── (admin)/         # 원장·강사 영역 (GNB + 사이드바 레이아웃)
│   │   │   ├── students/    # 학생 관리 (등록·출결·성적·리포트)
│   │   │   ├── classes/     # 반 관리 (시간표·출결체크·커리큘럼·보강·강사)
│   │   │   ├── finance/     # 재무 (청구·수납·미납·정산·영수증)
│   │   │   ├── calendar/    # 캘린더 (학원 일정·상담 일정)
│   │   │   ├── communication/ # 소통 (공지·상담·알림·문의)
│   │   │   ├── analytics/   # 통계 분석 대시보드
│   │   │   └── settings/    # 계정·학원 공개 페이지 설정
│   │   ├── ingang/          # 인강 (강의·태그·수강대상 DB 연동, Cloudflare Stream)
│   │   │   ├── lectures/    # 강의 목록·등록·태그·수강대상
│   │   │   ├── exams/       # 시험 출제 에디터 (mock)
│   │   │   └── completion/  # 시청·시험·이수율·알림·이수증 (mock)
│   │   ├── mobile/          # 학부모·학생 PWA (5탭 + 결제)
│   │   ├── kiosk/           # QR 출석 체크인 키오스크
│   │   ├── super-admin/     # 슈퍼어드민 학원 관리
│   │   ├── academy/[slug]/  # 학원 공개 소개 페이지 (인증 불필요)
│   │   └── api/             # API 라우트 (아래 목록 참고)
│   ├── components/
│   │   ├── admin/           # GNB, Sidebar, Topbar
│   │   ├── ingang/          # InGangSidebar (보라색 테마)
│   │   ├── mobile/          # BottomTabBar, SwRegister
│   │   ├── calendar/        # 캘린더 위젯
│   │   ├── communication/   # 알림·공지 UI
│   │   ├── charts/          # Recharts 차트
│   │   └── shared/          # Button, Modal, Badge, Avatar, SearchInput 등
│   └── lib/
│       ├── auth/            # jwt.ts, cookies.ts
│       ├── db/prisma.ts     # Prisma 싱글턴 (PrismaPg 어댑터)
│       ├── crypto/          # AES-256-GCM (토스 시크릿 키 암호화)
│       ├── kiosk/           # QR 생성, 세션 관리
│       ├── mock/            # 더미 데이터 (참고 전용, 수정 금지)
│       ├── stores/          # Zustand 스토어 11개
│       └── types/           # TypeScript 타입 정의
├── public/
│   ├── manifest.json        # PWA manifest (start_url=/mobile)
│   └── sw.js                # 서비스 워커
└── .github/                 # GitHub Actions CI/CD
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
| director / teacher | /(admin)/*, /ingang/* |
| parent / student | /mobile/* |
| 미인증 | /login, /kiosk |
| 공개(인증무관) | /academy/*, /api/academy/*, /api/kiosk/* |

---

## DB 스키마 주요 모델 (31개)

```
# 기본
Academy             학원 (테넌트 단위, 공개 프로필 필드 포함)
User                계정 (super_admin / director / teacher / parent / student)

# 학생·보호자
Student             학생 (StudentStatus: ACTIVE/ON_LEAVE/WITHDRAWN/WAITING)
Parent              보호자
StudentParent       학생-보호자 연결 (M:M)
StudentSibling      형제·자매 관계 (M:M, 양방향)

# 강사·반
Teacher             강사 (permissions JSON 포함)
Class               반 (color, fee, maxStudents)
ClassTeacher        반-강사 배정 (isPrimary 포함)
ClassEnrollment     수강 등록 (학생 ↔ 반, isActive)
ClassSchedule       수업 일정 (dayOfWeek 0-6, startTime, endTime)
CurriculumRow       주차별 커리큘럼 (week, topic, done)
Textbook            교재 (name, publisher, currentUnit, totalUnits)

# 출결·보강
AttendanceRecord    출결 기록 (PRESENT/ABSENT/LATE/EARLY_LEAVE)
MakeupClass         보강 수업 (originalDate, makeupDate)
MakeupClassTarget   보강 대상 학생 (M:M)

# 성적
Exam                시험 (classId, totalScore)
GradeRecord         성적 (score, rank, memo)

# 재무
Bill                청구서 (PAID/UNPAID/PARTIAL, paidAmount)
Receipt             영수증
Expense             지출 (category, amount)
PaymentOrder        토스페이먼츠 주문 (orderId ↔ billIds JSON)

# 소통
Notification        알림 (type, metadata JSON — billIds 등)
NotificationRecipient  알림 수신자 (readAt)
NotificationTemplate   알림 템플릿 (category, title, content)
ConsultationRecord  상담 기록 (type, topic, content, followUp)
Announcement        공지사항 (DRAFT/PUBLISHED, classId 선택)
PublicInquiry       공개 페이지 문의 (status: NEW/READ/REPLIED, memo)

# 캘린더
CalendarEvent       캘린더 일정 (isPublic, classId 선택)

# 인강
Lecture             강의 (subjects/levels/targetGrades String[], cfVideoId, DRAFT/PUBLISHED)
LectureTarget       수강 대상 (Lecture ↔ Class)
AcademyTag          학원별 커스텀 태그 (tagType: subject|level|grade)
```

> 모든 도메인 모델은 `academyId` FK 포함 → 학원별 데이터 격리.  
> API에서 `academyId`는 반드시 `req.headers.get('x-academy-id')`로 가져올 것 (body/query 값 신뢰 금지).

### Academy 공개 프로필 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `intro` | String? | 학원 소개글 |
| `directorName` | String? | 대표자명 |
| `businessNumber` | String? | 사업자등록번호 |
| `operatingHours` | String? | 운영 시간 |
| `refundPolicy` | String? | 환불 정책 |
| `showFees` | Boolean | 수강료 공개 여부 |
| `profileEnabled` | Boolean | 공개 페이지 활성화 여부 (false면 404) |
| `kakaoMapUrl` | String? | 카카오맵 퍼가기 iframe src |
| `galleryImages` | Json? | 사진 URL 배열 (최대 6장, Vercel Blob) |

---

## API 라우트 목록

### 공개 (인증 불필요)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/academy/[slug] | 학원 공개 프로필 (수강과목·갤러리·공지 포함) |
| POST | /api/academy/[slug]/inquiry | 공개 페이지 수강 문의 등록 |
| POST | /api/kiosk/session | 키오스크 QR 세션 생성 |
| GET | /api/kiosk/recent | 최근 체크인 목록 |
| POST | /api/kiosk/check-in | QR 또는 수동 학번으로 출석 체크인 |

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/login | 이메일+비밀번호 로그인 |
| POST | /api/auth/logout | 쿠키 삭제 |
| GET | /api/auth/me | 현재 사용자 정보 |

### 슈퍼어드민 (x-user-role: super_admin)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/super-admin/academies | 전체 학원 목록 |
| POST | /api/super-admin/academies | 학원 + 원장 계정 생성 |
| GET | /api/super-admin/academies/[id] | 학원 상세 (유저 목록 포함) |
| PATCH | /api/super-admin/academies/[id] | 학원 정보 수정 |
| PATCH | /api/super-admin/academies/[id]/users/[userId] | 계정 활성/비활성, 비밀번호 초기화 |
| PATCH | /api/super-admin/academies/[id]/toss-key | 학원별 토스페이먼츠 키 등록·수정 (AES-256-GCM 암호화 저장) |
| PATCH | /api/super-admin/profile/password | 슈퍼어드민 본인 비밀번호 변경 |

### 설정 (x-user-role: director)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/settings/academy | 학원 공개 프로필 조회 |
| PATCH | /api/settings/academy | 학원 공개 프로필 저장 |
| POST | /api/settings/gallery | 갤러리 이미지 업로드 (Vercel Blob) |

### 학생 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/students | 학생 목록 |
| POST | /api/students | 학생 등록 (User + Student + Parent + StudentParent 생성) |
| GET | /api/students/[id] | 학생 상세 |
| PATCH | /api/students/[id] | 학생 정보 수정 |
| DELETE | /api/students/[id] | 학생 비활성화 |
| POST | /api/students/[id]/reset-password | 학생 로그인 비밀번호 초기화 |

### 강사 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/teachers | 강사 목록 |
| POST | /api/teachers | 강사 등록 |
| GET | /api/teachers/[id] | 강사 상세 |
| PATCH | /api/teachers/[id] | 강사 정보·권한 수정 |
| POST | /api/teachers/[id]/reset-password | 강사 비밀번호 초기화 |

### 반 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/classes | 반 목록 |
| POST | /api/classes | 반 등록 |
| GET | /api/classes/[id] | 반 상세 (등록학생·스케줄 포함) |
| PATCH | /api/classes/[id] | 반 정보 수정 |
| GET | /api/classes/[id]/curriculum | 주차별 커리큘럼 목록 |
| POST | /api/classes/[id]/curriculum | 커리큘럼 행 추가 |
| PATCH | /api/classes/[id]/curriculum/[rowId] | 커리큘럼 수정 |
| GET | /api/classes/[id]/textbooks | 교재 목록 |
| POST | /api/classes/[id]/textbooks | 교재 추가 |
| PATCH | /api/classes/[id]/textbooks/[tbId] | 교재 수정 |

### 보강 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/makeup | 보강 목록 |
| POST | /api/makeup | 보강 등록 |
| PATCH | /api/makeup/[id] | 보강 수정 |

### 출결 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/attendance | 출결 기록 (date·classId·studentId 필터) |
| POST | /api/attendance | 출결 생성/갱신 |
| PATCH | /api/attendance/[id] | 단건 출결 수정 |

### 성적·시험 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/exams?classId= | 반별 시험 목록 |
| POST | /api/exams | 시험 등록 |
| DELETE | /api/exams/[id] | 시험 삭제 (연결된 성적 포함) |
| GET | /api/grades?examId= | 시험별 성적 목록 |
| POST | /api/grades | 성적 일괄 upsert |
| PATCH | /api/grades/[id] | 성적 수정 |

### 재무 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/finance/bills | 청구서 목록 (studentId·status 필터) |
| POST | /api/finance/bills | 청구서 생성 |
| POST | /api/finance/bills/[id]/pay | 수납 처리 (deprecated, 모바일 결제 권장) |
| GET | /api/finance/expenses | 지출 목록 |
| POST | /api/finance/expenses | 지출 등록 |
| GET | /api/finance/receipts | 영수증 목록 |

### 소통 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/communication/announcements | 공지 목록 |
| POST | /api/communication/announcements | 공지 등록 (classId 선택 — null=전체) |
| PATCH | /api/communication/announcements/[id] | 공지 수정 |
| GET | /api/communication/consultations | 상담 목록 |
| POST | /api/communication/consultations | 상담 기록 등록 |
| GET | /api/communication/consultations/[id] | 상담 상세 |
| GET | /api/communication/notifications | 알림 목록 |
| POST | /api/communication/notifications | 알림 발송 (metadata.billIds 지원) |
| GET | /api/communication/inquiries | 공개 페이지 문의 목록 |
| PATCH | /api/communication/inquiries/[id] | 문의 상태·메모 수정 |
| GET | /api/communication/notification-templates | 알림 템플릿 목록 |
| POST | /api/communication/notification-templates | 템플릿 생성 |

### 캘린더 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/calendar | 일정 목록 (classId 필터 지원) |
| POST | /api/calendar | 일정 등록 (classId 선택 — null=전체) |
| PATCH | /api/calendar/[id] | 일정 수정 |

### 통계
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/analytics/monthly | 월별 대시보드 통계 (학생 수·출결률·수납률 등) |

### 인강 (x-academy-id 필수)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/lectures | 강의 목록 (orderIndex asc → createdAt desc) |
| POST | /api/lectures | 강의 등록 |
| GET | /api/lectures/[id] | 강의 상세 |
| PATCH | /api/lectures/[id] | 강의 수정 |
| DELETE | /api/lectures/[id] | 강의 삭제 |
| GET | /api/lectures/tags | 학원별 커스텀 태그 목록 |
| POST | /api/lectures/tags | 커스텀 태그 추가 (중복 시 409) |
| DELETE | /api/lectures/tags/[id] | 커스텀 태그 삭제 |
| POST | /api/lectures/upload-url | Cloudflare Stream Direct Upload URL 발급 → `{ uploadURL, uid }` |

### 모바일 (x-user-role: parent/student)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/mobile/me | 현재 사용자 프로필 + 수강반 |
| GET | /api/mobile/children | (parent 전용) 자녀 목록 |
| GET | /api/mobile/grades | 성적 조회 (본인 또는 자녀) |
| GET | /api/mobile/announcements | 공지 조회 (수강반 필터) |
| GET | /api/mobile/calendar | 일정 조회 (수강반 필터) |
| GET | /api/mobile/attendance | 출결 이력 |
| GET | /api/mobile/schedule | 수업 일정 |
| GET | /api/mobile/notifications | 알림 목록 |
| GET | /api/mobile/payments | 미납 청구서 목록 |
| POST | /api/mobile/payments/order | 토스 결제 주문 생성 (orderId 반환) |
| GET | /api/mobile/payments/toss-client-key | NEXT_PUBLIC_TOSS_CLIENT_KEY 조회 |
| POST | /api/mobile/payments/toss/confirm | 토스 결제 승인 → Bill PAID + Receipt 생성 |

---

## 상태 관리 (Zustand Stores)

`src/lib/stores/` 에 위치:

| 파일 | 역할 |
|------|------|
| `authStore.ts` | 현재 사용자, 로그인/로그아웃 |
| `studentStore.ts` | 학생 목록, CRUD |
| `classStore.ts` | 반 목록, 수강 등록, 스케줄 |
| `teacherStore.ts` | 강사 목록, 권한 |
| `attendanceStore.ts` | 출결 기록 |
| `gradeStore.ts` | 시험, 성적 |
| `financeStore.ts` | 청구서, 영수증, 지출 |
| `communicationStore.ts` | 공지, 알림, 상담 |
| `calendarStore.ts` | 캘린더 일정 |
| `makeupStore.ts` | 보강 수업 |
| `toastStore.ts` | 토스트 알림 (success/error/info) |

패턴: 각 store는 API에서 데이터 fetch → 로컬 state 업데이트 → 에러 처리.

---

## 공용 컴포넌트 (`src/components/shared/`)

| 컴포넌트 | 설명 |
|---------|------|
| `Button` | variant: default/dark/primary/danger/ghost, size: sm/md/lg |
| `Modal` | 다이얼로그 래퍼 |
| `Badge` | 상태 태그 |
| `Avatar` | 색상 아바타 (avatarColor 필드 사용) |
| `SearchInput` | 검색창 |
| `FilterTags` | 태그 필터 위젯 |
| `Tabs` | 탭 인터페이스 |
| `ToastContainer` | 토스트 알림 영역 |

**디자인 토큰**:
- Primary `#1a2535` · Accent `#4fc3a1` · Border `#e2e8f0`
- Text `#111827` / Muted `#6b7280` / Faint `#9ca3af`
- Radius: card 12px / input 10px / button 8px
- Base font: 13px · Header height: 50px

**인강 전용 테마** (보라색 사이드바):
- BG `#1e1b2e` · Accent `#a78bfa` · Sub-accent `#5B4FBE` · Highlight `#EEEDFE`

---

## 개발 현황

### Phase A–B (완료)
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
- [x] 성적/시험 DB 연동 — `/api/exams`, `/api/grades`

### Phase C (완료)
- [x] 반 관리 UI 고도화: 반 CRUD, 월별 캘린더 시간표, 학생 수강 등록/해제
- [x] 커리큘럼·보강·강사 관리: 주차별 커리큘럼, 보강 일정, 반별 강사 배정
- [x] 출결 현황·학생 리포트 페이지 개선
- [x] 전 도메인 DB API 전환 완료 (학생·반·출결·재무·소통·캘린더·성적)
- [x] 모바일 PWA API (`/api/mobile/grades`, `/api/mobile/announcements`, `/api/mobile/calendar`)
- [x] Vercel 배포 완료

### Phase D (완료) — 모바일 PWA 실제 데이터 연동
- [x] JWT 인증 기반 모바일 API 구현 (`me`, `attendance`, `payments`, `schedule`, `notifications`)
- [x] 모바일 5개 페이지: 하드코딩 → JWT userId 기반 실제 DB 조회
- [x] 역할 분기: student(직접 조회) / parent(자녀 연결 통해 조회) 공통 처리
- [x] 로그아웃 버튼 (프로필 페이지 하단, POST /api/auth/logout → /login)
- [x] 시드 loginId 형식 확정: `학원고유키 + 출석번호` (예: `SGR1001`), 비밀번호 8자리

### Phase E (완료) — 토스페이먼츠 결제 + 학원 공개 페이지
- [x] 토스페이먼츠 인앱 결제 (모바일 알림/수납 → 결제창 → confirm API → Bill PAID + Receipt)
- [x] `PaymentOrder` 모델로 `orderId ↔ billIds` 매핑
- [x] 결제 성공/실패 안내 페이지 (`/mobile/payments/success`, `/mobile/payments/fail`)
- [x] 청구 알림에 `billIds` 메타데이터 포함 (`Notification.metadata`)
- [x] 학원별 공개 소개 페이지 `/academy/[slug]` (수강과목·갤러리·지도·운영시간·환불정책)
- [x] 원장이 설정 탭에서 공개 페이지 내용 편집 + 공개 ON/OFF
- [x] Vercel Blob 갤러리 이미지 업로드 (`/api/settings/gallery`)
- [x] 슈퍼어드민 → 학원별 토스 키 등록 (AES-256-GCM 암호화 저장)

### Phase F (완료) — 인강 DB 연동 + Cloudflare Stream
- [x] DB 모델: `Lecture`, `LectureTarget`, `AcademyTag` (schema.prisma 추가)
- [x] API CRUD: `/api/lectures/*`, 커스텀 태그: `/api/lectures/tags/*`
- [x] Cloudflare Stream Direct Creator Upload (`tus-js-client` 동적 import)
- [x] 강의 카드 그리드, 등록 폼, 태그 관리, 수강대상 지정 (강의 목록 DB 연동)
- [x] 재생: `https://iframe.videodelivery.net/{cfVideoId}` (iframe)

> **Cloudflare Stream 주의**: 무료 tier는 업로드 불가(0분). $5/월 1,000분 플랜 이상 필요.
> 유료 플랜 사용 전에는 강의 등록 폼의 **"외부 영상 URL"** 입력란에 YouTube Embed URL을 넣어 대신 사용하세요.
> YouTube Embed URL 형식: `https://www.youtube.com/embed/{VIDEO_ID}`
> `videoUrl`과 `cfVideoId` 중 `cfVideoId`가 우선 재생되며, `cfVideoId`가 없으면 `videoUrl`이 사용됩니다.

### Phase G (미구현 — 향후)
- [ ] 인강 백엔드: 시청 진도 추적, 시험 응시·자동 채점 (ExamQuestion, ViewProgress, CompletionRecord 모델 필요)
- [ ] 이수증 PDF 발급
- [ ] 카카오 알림톡 발송 (비즈채널 + 대행사 계약)
- [ ] Web Push 알림 (iOS 16.4+ / Android)
- [ ] 키오스크 QR 출석 체크인 UI 완성
- [ ] 정산서 PDF 출력
- [ ] 카카오페이 등 추가 결제수단
- [ ] NestJS 백엔드 마이그레이션 (장기 계획)

---

## 토스페이먼츠 학원 등록 절차 (운영 가이드)

새 학원이 토스페이먼츠 결제를 사용하려면 아래 3단계를 완료해야 합니다.

---

### 1단계 — 토스페이먼츠 상점 계정 발급 (학원 자체 진행)

1. [토스페이먼츠 홈페이지](https://www.tosspayments.com) → **사업자 가입**
2. 사업자등록증, 계좌 정보 제출 후 심사 (영업일 1~3일)
3. 심사 통과 시 **대시보드** 발급
4. 대시보드 → **개발 연동** → API 키 메뉴에서 아래 2가지 키 복사:
   - **Client Key** (`test_ck_...` 또는 `live_ck_...`)
   - **Secret Key** (`test_sk_...` 또는 `live_sk_...`)
   > ⚠️ `test_` 키로 먼저 테스트 후 운영 전환 시 `live_` 키로 교체

---

### 2단계 — 슈퍼어드민 페이지에서 키 등록

1. 슈퍼어드민 계정으로 로그인 → `/super-admin` 이동
2. 해당 학원 상세 클릭
3. **토스페이먼츠 결제 키** 섹션에서:
   - **Client Key** 입력 (예: `live_ck_xxxxxxxx`)
   - **Secret Key** 입력 (예: `live_sk_xxxxxxxx`)
   - **저장** 클릭
   > Secret Key는 AES-256-GCM으로 암호화되어 DB에 저장됩니다. 원문은 저장되지 않습니다.

4. **웹훅 URL** 항목에 자동 생성된 URL을 복사합니다:
   ```
   https://acams-jmi3.vercel.app/api/webhooks/toss?academyId=<학원ID>
   ```

---

### 3단계 — 토스페이먼츠 대시보드에서 웹훅 URL 등록

> 웹훅은 **학부모가 결제 직후 브라우저를 닫거나 네트워크가 끊겨도** 서버가 결제 완료를 수신하기 위해 필수입니다.

1. 토스페이먼츠 대시보드 → **개발 연동** → **웹훅**
2. **웹훅 추가** 클릭
3. 위에서 복사한 URL 붙여넣기
4. 이벤트: **`PAYMENT_STATUS_CHANGED`** 체크
5. **저장**

> **학원마다 academyId가 다르므로 URL이 다릅니다.** 학원별로 각각 등록해야 합니다.

---

### 등록 완료 확인

- 슈퍼어드민 학원 상세 페이지에서 "키 등록됨 (YYYY-MM-DD)" 표시 확인
- 모바일 앱 → 수납 탭 → 미납 청구서 → 결제하기 버튼이 활성화되면 정상

---

### 키 환경 주의사항

| 키 접두사 | 환경 | 실제 결제 여부 |
|-----------|------|---------------|
| `test_ck_` / `test_sk_` | 테스트 | ❌ 결제 미발생 (카드 테스트 번호 사용) |
| `live_ck_` / `live_sk_` | 운영 | ✅ 실제 결제 발생 |

> Client Key (`test_ck_` / `live_ck_`)와 Secret Key (`test_sk_` / `live_sk_`)는 반드시 **같은 환경**의 키 쌍을 사용해야 합니다. API가 불일치를 감지하면 저장을 거부합니다.

---

### 관련 환경 변수 (서버 전역)

```env
# .env.local (Vercel 환경 변수 설정)
TOSS_ENCRYPT_KEY=<32바이트 hex — Secret Key 암호화용>
```

> `TOSS_ENCRYPT_KEY`는 슈퍼어드민이 학원 Secret Key를 저장할 때 AES 암호화에 사용합니다.
> Vercel 프로젝트 설정 → Environment Variables에 이미 등록되어 있어야 합니다.

---

## 결제 플로우 (토스페이먼츠)

```
모바일 알림/수납 → "결제하기"
  ↓ POST /api/mobile/payments/order (billIds 검증, 금액 서버 확인, PaymentOrder 생성)
  ↓ GET /api/mobile/payments/toss-client-key (클라이언트 키)
  ↓ 토스 SDK requestPayment()
  ↓ 결제 완료 → /mobile/payments/success?paymentKey=&orderId=&amount=
  ↓ POST /api/mobile/payments/toss/confirm (Toss API 승인 → Bill PAID, Receipt 생성)
```

### 취소/재청구 플로우

```
관리자 → 청구/수납 탭 → 완납 청구서 행 → [취소] 버튼
  ↓ POST /api/finance/bills/[id]/cancel
  ↓ 토스 결제건(paymentOrderId 있음): Toss 취소 API 호출 → 동일 주문 청구서 전체 CANCELLED
  ↓ 수동 수납건(paymentOrderId 없음): 해당 청구서만 CANCELLED
  ↓ 연결된 영수증 모두 cancelledAt 기록

취소됨 청구서 선택 → [재청구] 버튼 → 재청구 모달
  ↓ 실출결 기준 자동 계산액 표시 (원장 수정 가능)
  ↓ POST /api/finance/bills/rebill
  ↓ 새 UNPAID 청구서 생성 (rebillOfId → 원본 취소 청구서 연결)
  ↓ sendNotification=true 시 학부모 앱에 "해당 월 결제 취소 후 재청구" 알림 발송
```

---

## Cloudflare Stream 업로드 플로우

```
[Cloudflare Stream — 유료 플랜 필요]
강의 등록 폼 → POST /api/lectures/upload-url → { uploadURL, uid }
  → tus-js-client (동적 import) → Cloudflare TUS 엔드포인트 직접 업로드
  → 완료 시 cfVideoId(uid) 저장 → POST /api/lectures
  → 재생: https://iframe.videodelivery.net/{cfVideoId} (iframe)

[YouTube Embed URL — 무료 대안]
강의 등록 폼 "외부 영상 URL" 입력란에 YouTube Embed URL 직접 입력
  → videoUrl 저장 → POST /api/lectures
  → 재생: <iframe src={videoUrl}> (cfVideoId 없을 때 fallback)
  → YouTube Embed URL 형식: https://www.youtube.com/embed/{VIDEO_ID}
```

---

## Prisma 7 Breaking Changes

```typescript
// ❌ Prisma 5 이하 방식
import { PrismaClient } from '@prisma/client';

// ✅ Prisma 7 방식 (driver adapter 필수)
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client'; // /client 명시 필수

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
```

- `generator` 이름: `prisma-client` (구: `prisma-client-js`)
- 클라이언트 생성 경로: `src/generated/prisma/` → import 시 `/client` 까지 명시
- datasource URL: `schema.prisma`가 아닌 `prisma.config.ts`에서 관리

---

## Next.js 16 Breaking Changes

```typescript
// 미들웨어: middleware.ts → proxy.ts, 함수명: proxy()
export async function proxy(req: NextRequest) { ... }

// cookies(), headers() 전부 async
const cookieStore = await cookies();

// Route params도 async
type RouteContext = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
}

// 헤더에 한글 값 포함 시 URL 인코딩 필수
requestHeaders.set('x-user-name', encodeURIComponent(name));
// 읽을 때: decodeURIComponent(req.headers.get('x-user-name') ?? '')
```
