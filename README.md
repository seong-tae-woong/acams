# AcaMS — 학원 관리 시스템

학원 운영에 필요한 학생 관리, 출결, 성적·리포트, 재무, 소통, 인강 기능을 제공하는 멀티테넌트 SaaS.

> 서비스 브랜드: **학원로그** (UI 워드마크). 코드베이스·저장소 코드네임은 `AcaMS`.

---

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.2.4 |
| 언어 | TypeScript | 5.x |
| UI | React | 19.2.4 |
| 스타일 | Tailwind CSS | v4 |
| 상태 관리 | Zustand | 5.0.12 |
| DB | PostgreSQL (Neon 서버리스) | — |
| ORM | Prisma + @prisma/adapter-pg | 7.7.0 |
| 인증 | JWT (jose / jsonwebtoken) + bcryptjs | — |
| 결제 | 토스페이먼츠 SDK | 2.7.0 |
| 영상 | Cloudflare Stream + tus-js-client | 4.3.1 |
| 스토리지 | Vercel Blob | 2.3.3 |
| 웹푸시 | web-push (VAPID) | 3.6.7 |
| SMS | Solapi REST API | — |
| QR | qrcode / html5-qrcode | 1.5.4 / 2.3.8 |
| 차트 | Recharts | 3.8.1 |
| 아이콘 | lucide-react | 1.8.0 |
| 폰트 | Pretendard (jsDelivr CDN) | 1.3.9 |
| 배포 | Vercel | — |

---

## 배포 환경

| 구분 | URL |
|------|-----|
| 프로덕션 (커스텀 도메인) | https://hw-log.co.kr |
| 프로덕션 (Vercel 기본) | https://acams-jmi3.vercel.app |
| DB | Neon PostgreSQL (ap-southeast-1, connection pooling 활성화) |
| GitHub | https://github.com/seong-tae-woong/acams |

`master` 브랜치 푸시 시 Vercel 자동 배포. DB 스키마 변경분은 `npx prisma db push`로 수동 반영.

---

## 환경 변수

`.env` 파일 (절대 커밋 금지). Vercel → Settings → Environment Variables 에도 동일하게 등록:

```env
# 데이터베이스 (Neon PostgreSQL)
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require

# 인증
JWT_SECRET=<64자 이상 랜덤 문자열>
JWT_EXPIRES_IN=7d
COOKIE_SECURE=true                       # 배포(HTTPS) 환경에서 true

# 토스페이먼츠 — 학원별 결제 키는 DB에 암호화 저장. 아래는 그 암호화 키
TOSS_KEY_ENC_SECRET=<32바이트 hex — Secret Key AES-256-GCM 암호화용>

# 웹푸시 (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<VAPID 공개키>
VAPID_PRIVATE_KEY=<VAPID 비밀키>
VAPID_SUBJECT=mailto:admin@hw-log.co.kr

# SMS (Solapi)
SOLAPI_API_KEY=<Solapi API 키>
SOLAPI_API_SECRET=<Solapi API 시크릿>
SOLAPI_SENDER=<발신 등록 전화번호>

# 스토리지 / 영상
BLOB_READ_WRITE_TOKEN=<Vercel Blob 토큰>
CF_ACCOUNT_ID=<Cloudflare 계정 ID>
CF_STREAM_API_TOKEN=<Cloudflare Stream API 토큰>
```

> 토스페이먼츠 Client/Secret Key는 전역 환경 변수가 아니라 **학원(Academy)별로 DB에 저장**됩니다. Secret Key는 `TOSS_KEY_ENC_SECRET`으로 AES-256-GCM 암호화되어 보관됩니다.

---

## 로컬 실행

```bash
npm install
npx prisma generate       # Prisma 클라이언트 생성 (src/generated/prisma/)
npx prisma db push        # DB 스키마 적용
npx prisma db seed        # 테스트 데이터 삽입 (tsx prisma/seed.ts)
npm run dev               # http://localhost:3000
```

### npm 스크립트

| 스크립트 | 명령 |
|---------|------|
| `npm run dev` | `next dev` |
| `npm run build` | `prisma generate && next build` |
| `npm start` | `next start` (프로덕션 서버) |

> 시드 명령은 `prisma.config.ts`의 `migrations.seed`(`tsx prisma/seed.ts`)가 기준입니다. `package.json`의 `prisma.seed` 항목은 레거시.

### 시드 계정

| 역할 | 이메일 / 로그인ID | 초기 비밀번호 | 비고 |
|------|------------------|-------------|------|
| 슈퍼어드민 | superadmin@acams.kr | acams2026! | 배포 후 반드시 변경 |
| 원장 | director@segyero.kr | segyero2026! | 세계로 학원 |
| 강사 (3명) | kim·park·lee@segyero.kr | teacher2026! | 김·박·이 선생 |
| 학생 (20명) | SGR1001 ~ SGR1020 | SeedSt24 | `loginId = 학원 loginKey + 출석번호` |
| 학부모 (20명) | 전화번호 (010-xxxx-xxxx) | SeedPr24 | 학생 1인당 1보호자 |

> 시드 데이터: 학원 1개, 반 5개, 강사 3명, 학생·학부모 각 20명. 실제 계정 등록 시 임시 비밀번호는 랜덤 생성되어 SMS로 발송됩니다.

---

## 프로젝트 구조

```
acams/
├── prisma/
│   ├── schema.prisma        # DB 스키마 (51개 모델)
│   └── seed.ts              # 테스트 데이터 스크립트
├── prisma.config.ts         # Prisma 7 설정 (datasource URL, seed 커맨드)
├── src/
│   ├── proxy.ts             # Next.js 16 미들웨어 (JWT 검증, 역할 접근 제어)
│   ├── generated/prisma/    # Prisma 생성 클라이언트 (git 제외, generate로 생성)
│   ├── app/
│   │   ├── page.tsx         # 루트 → 역할별 리다이렉트
│   │   ├── login/           # 로그인
│   │   ├── change-password/ # 비밀번호 변경
│   │   ├── (admin)/         # 원장·강사 영역 (GNB + 사이드바)
│   │   │   ├── students/    # 학생 관리 (등록·출결·성적·리포트)
│   │   │   ├── classes/     # 반 관리 (시간표·출결체크·커리큘럼·보강·강사)
│   │   │   ├── finance/     # 재무 (청구·수납·미납·정산·영수증)
│   │   │   ├── calendar/    # 캘린더 (학원 일정·상담 일정)
│   │   │   ├── communication/ # 소통 (공지·상담·알림·문의·리포트 양식)
│   │   │   ├── analytics/   # 통계 분석 대시보드
│   │   │   └── settings/    # 계정·학원 공개 페이지·태블릿 설정
│   │   ├── ingang/          # 인강 관리 (보라색 테마, 강의·시험·재응시·태그)
│   │   ├── ingang-tablet/   # 학생 인강 시청용 태블릿 UI
│   │   ├── mobile/          # 학부모·학생 PWA (홈·출결·성적·공지·내정보·결제·리포트)
│   │   ├── kiosk/           # QR / 출결번호 출석 체크인 키오스크
│   │   ├── super-admin/     # 슈퍼어드민 학원 관리
│   │   ├── academy/[slug]/  # 학원 공개 소개 페이지 (인증 불필요)
│   │   └── api/             # API 라우트 (아래 목록 참고)
│   ├── components/
│   │   ├── admin/           # GNB, Sidebar 등
│   │   ├── ingang/          # InGangSidebar (보라색 테마)
│   │   ├── mobile/          # BottomTabBar, SwRegister 등
│   │   └── shared/          # Button, Modal, Badge, Wordmark 등 공용
│   ├── contexts/            # React Context
│   └── lib/
│       ├── auth/            # jwt, cookies, requireAuth, validateSession, rateLimit, auditLog, passwordValidator
│       ├── calendar/        # virtualEvents (보강·수업 파생 일정)
│       ├── crypto/          # tossKey (AES-256-GCM 토스 키 암호화)
│       ├── db/              # prisma 싱글턴 (PrismaPg 어댑터)
│       ├── kiosk/           # QR 토큰 생성·검증
│       ├── mobile/          # resolveStudent, toss
│       ├── push/            # web-push 발송, 클라이언트 구독
│       ├── reports/         # 리포트 컨텍스트·정기 리포트·토큰 치환
│       ├── sms/             # solapi SMS 발송
│       ├── stores/          # Zustand 스토어 11개
│       ├── types/           # TypeScript 도메인 타입
│       └── utils/           # billing, format
├── public/
│   ├── manifest.json        # PWA manifest (start_url=/mobile)
│   └── sw.js                # 서비스 워커 (웹푸시 수신)
└── .github/                 # GitHub Actions CI/CD
```

---

## 인증 흐름

```
[브라우저] POST /api/auth/login
    → bcrypt 비교 → JWT 발급 → httpOnly 쿠키(acams_token, JWT_EXPIRES_IN) 설정

[모든 요청] src/proxy.ts (Next.js 16 미들웨어)
    → 쿠키에서 JWT 추출 → jose로 검증
    → 헤더 주입: x-user-id, x-user-role, x-academy-id, x-user-name(URL인코딩)
    → 역할별 접근 제어
```

API 라우트는 대부분 `requireAuth(req)`로 인증 + 멀티테넌트(`academyId`)·세션(계정 활성·토큰 버전) 검증을 수행합니다. 슈퍼어드민·태블릿·일부 라우트는 `x-user-role` / `x-user-id` 헤더를 직접 읽어 역할을 검사합니다.

### 역할별 접근 경로

| 역할 | 접근 가능 경로 |
|------|--------------|
| super_admin | /super-admin/* |
| director / teacher | /(admin)/*, /ingang/* |
| parent / student | /mobile/* |
| tablet | /ingang-tablet/* (인강 시청 태블릿) |
| 미인증 | /login, /kiosk |
| 공개(인증무관) | /academy/*, /api/academy/*, /api/auth/login, /api/auth/change-password, /api/gallery-proxy, /api/kiosk/session, /api/kiosk/recent |

---

## DB 스키마 (51개 모델)

모든 도메인 모델은 `academyId` FK 포함 → 학원별 데이터 격리. API에서 `academyId`는 반드시 `req.headers.get('x-academy-id')`로 가져올 것 (body/query 값 신뢰 금지).

### 기본 · 인증

| 모델 | 설명 |
|------|------|
| `Academy` | 학원(테넌트) — 학원 정보, 토스 키(암호화), 공개 소개 페이지 설정 |
| `User` | 통합 계정 — super_admin / director / teacher / parent / student / tablet |
| `PushSubscription` | 웹푸시(PWA) 구독 정보 (endpoint·p256dh·auth) |
| `AuditLog` | 감사 로그 — 사용자 액션 추적 (action, target, detail) |
| `PasswordHistory` | 비밀번호 변경 이력 — 재사용 방지용 해시 |

### 학생 · 보호자

| 모델 | 설명 |
|------|------|
| `Student` | 학생 — 학교·학년·상태·출석번호·QR코드 |
| `StudentSibling` | 학생 간 형제·자매 연결 (조인) |
| `Parent` | 학부모 — 이름·전화번호 |
| `StudentParent` | 학생↔학부모 다대다 조인 |

### 강사 · 반

| 모델 | 설명 |
|------|------|
| `Teacher` | 강사 — 담당 과목, 권한(JSON) |
| `Class` | 반 — 과목·레벨·정원·수강료 |
| `ClassTeacher` | 반↔강사 조인 (isPrimary 주담당) |
| `ClassEnrollment` | 반 수강 등록 (등록·탈퇴일, 활성 여부) |
| `ClassSchedule` | 반 정기 시간표 (요일·시작/종료) |
| `Textbook` | 교재 — 출판사·진도·ISBN·가격 |
| `CurriculumRow` | 커리큘럼 행 — 주차/단원별 주제·진행 |

### 출결 · 보강

| 모델 | 설명 |
|------|------|
| `AttendanceRecord` | 출결 기록 — 입/퇴실 시각, 체크 강사 |
| `MakeupClass` | 보강 수업 — 원수업·원일자·보강 일시 |
| `MakeupClassTarget` | 보강 대상 학생 (조인, 보강 출결) |

### 성적 · 과제

| 모델 | 설명 |
|------|------|
| `Exam` | 시험 — 만점·일자·3단계 카테고리 |
| `ExamCategory` | 시험 분류 — 계층형 (level 1/2/3) |
| `GradeRecord` | 성적 — 점수·석차·메모 |
| `Assignment` | 과제 — 출제일·납기일·메모 (반 단위) |

### 재무

| 모델 | 설명 |
|------|------|
| `Bill` | 청구서 — 월별 청구·수납·조정·재청구 추적 |
| `BillAdjustment` | 청구액 조정 이력 (조정 1건당 1행) |
| `Expense` | 학원 지출 — 분류·설명·금액·일자 |
| `Receipt` | 영수증 — 청구서별 수납, 취소 추적 |
| `PaymentOrder` | 토스 결제 주문 — orderId ↔ billIds(JSON) |

### 소통

| 모델 | 설명 |
|------|------|
| `Notification` | 발송 알림 — 유형·제목·내용·메타데이터 |
| `NotificationRecipient` | 알림 수신자 — 학생별 읽음 시각 |
| `NotificationTemplate` | 알림 템플릿 — 카테고리별 양식 |
| `ConsultationRecord` | 상담 기록 — 일시·유형·주제·후속 |
| `Announcement` | 공지사항 — 상태·고정·발행, 반 지정 가능 |
| `PublicInquiry` | 공개 페이지 상담 신청 |

### 캘린더

| 모델 | 설명 |
|------|------|
| `CalendarEvent` | 캘린더 일정 — 학원·상담·보강, 공개 여부 |
| `ClassEvent` | 반 일회성(단발) 수업 일정 |

### 인강

| 모델 | 설명 |
|------|------|
| `Lecture` | 강의 — 영상(Cloudflare Stream), 태그, 시리즈/회차 |
| `LectureSeries` | 강의 시리즈(묶음) |
| `LectureTarget` | 강의↔반 수강대상 조인 |
| `LectureStudentTarget` | 강의↔개별 학생 수강대상 조인 |
| `AcademyTag` | 학원별 커스텀 인강 태그 |
| `LectureQuiz` | 인강 시험 — 합격점·응시횟수·이수조건 |
| `LectureQuestion` | 인강 시험 문항 — 문제·배점 |
| `LectureQuestionOption` | 인강 시험 보기 — 텍스트·정답 여부 |
| `LectureQuizAttempt` | 인강 시험 응시 기록 — 점수·합격 여부 |
| `LectureRetryPermission` | 인강 시험 재응시 허가 |
| `StudentLectureNote` | 강사가 강의별 학생에게 남긴 코멘트 |
| `IngangViewSession` | 학생 인강 시청 세션 (인증요청→승인→시청→종료) |
| `IngangDailyCode` | 학원별 일일 인강 인증 코드 (6자리) |

### 리포트

| 모델 | 설명 |
|------|------|
| `ReportTemplate` | 성적 리포트 양식 — 시험별/정기, 본문 토큰·레이아웃 |
| `Report` | 발행된 학생 성적 리포트 — 렌더링 본문·차트 |

### Enum (13개)

| Enum | 값 |
|------|-----|
| `UserRole` | super_admin, director, teacher, parent, student, tablet |
| `StudentStatus` | ACTIVE, ON_LEAVE, WITHDRAWN, WAITING |
| `AttendanceStatus` | PRESENT, ABSENT, LATE, EARLY_LEAVE |
| `BillStatus` | PAID, UNPAID, PARTIAL, CANCELLED |
| `PaymentMethod` | CARD, TRANSFER, CASH |
| `NotificationType` | ANNOUNCEMENT, ATTENDANCE_ALERT, PAYMENT_ALERT, CONSULTATION_ALERT, GENERAL |
| `AnnouncementStatus` | DRAFT, PUBLISHED |
| `InquiryStatus` | NEW, READ, REPLIED |
| `CalendarEventType` | ACADEMY_SCHEDULE, CONSULTATION_SCHEDULE, MAKEUP_SCHEDULE |
| `CurriculumUnitType` | MONTH, WEEK, SESSION |
| `LectureStatus` | DRAFT, PUBLISHED |
| `LectureTargetMode` | CLASS, INDIVIDUAL, ALL |
| `ReportTemplateKind` | PER_EXAM, PERIODIC |

> `IngangViewSession.status`, `PaymentOrder.status`는 Prisma enum이 아닌 `String` 필드.

---

## API 라우트 목록

총 99개 라우트. 별도 표시가 없으면 `requireAuth`(JWT 쿠키 + 멀티테넌트 검증) 적용.

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/login | 로그인, JWT 쿠키 발급 (공개, IP 레이트리밋·계정잠금) |
| POST | /api/auth/logout | 로그아웃 (tokenVersion 증가로 토큰 무효화) |
| GET | /api/auth/me | 현재 사용자 정보 |
| POST | /api/auth/change-password | 비밀번호 변경, 새 JWT 발급 (공개 — JWT 쿠키 직접 검증) |

### 슈퍼어드민 (super_admin 전용)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/super-admin/academies | 학원 목록 / 학원+원장 생성 |
| GET | /api/super-admin/academies/check | 학원명·키·슬러그 중복 확인 |
| GET·PATCH | /api/super-admin/academies/[id] | 학원 상세 / 정보 수정 |
| GET·PATCH | /api/super-admin/academies/[id]/toss-key | 학원 토스 키 조회 / 등록·교체 |
| POST | /api/super-admin/academies/[id]/users | 원장·강사 계정 추가 |
| PATCH·DELETE | /api/super-admin/academies/[id]/users/[userId] | 계정 수정 / 삭제 (최소 1명 원장 보호) |
| PATCH | /api/super-admin/profile/password | 슈퍼어드민 본인 비밀번호 변경 |

### 설정 (director)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·PATCH | /api/settings/academy | 학원 공개 프로필 조회 / 저장 |
| POST·DELETE | /api/settings/gallery | 학원 사진 업로드 / 삭제 (Vercel Blob) |
| GET·POST | /api/settings/tablets | 태블릿 계정 목록 / 생성 |
| PATCH·DELETE | /api/settings/tablets/[id] | 태블릿 계정 수정 / 삭제 |

### 학생
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/students | 학생 목록 / 등록 (학생·학부모 계정 생성, 임시PW SMS) |
| GET·PATCH | /api/students/[id] | 학생 상세 / 정보·수강반 수정 |
| POST | /api/students/[id]/siblings | 형제·자매 연결 전체 교체 |
| POST | /api/students/[id]/reset-password | 학생·학부모 비밀번호 초기화 (SMS) |

### 강사
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/teachers | 강사 목록 / 등록 (임시PW SMS) |
| PATCH | /api/teachers/[id] | 강사 정보·권한 수정 |
| POST | /api/teachers/[id]/reset-password | 강사 비밀번호 초기화 (SMS) |

### 반
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/classes | 반 목록 / 생성 |
| GET·PATCH·DELETE | /api/classes/[id] | 반 상세 / 수정 / 삭제(soft) |
| GET·POST | /api/classes/[id]/curriculum | 커리큘럼 목록 / 추가 |
| PATCH·DELETE | /api/classes/[id]/curriculum/[rowId] | 커리큘럼 수정 / 삭제 |
| GET·POST | /api/classes/[id]/textbooks | 교재 목록 / 추가 |
| PATCH·DELETE | /api/classes/[id]/textbooks/[tbId] | 교재 수정 / 삭제 |
| GET·POST | /api/class-events | 일회성 수업 일정 목록 / 등록 |

### 보강
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/makeup | 보강 목록 / 등록 |
| PATCH·DELETE | /api/makeup/[id] | 보강 수정·대상·출결 / 삭제 |

### 출결
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/attendance | 출결 조회 / 반·날짜 단위 일괄 upsert |
| PATCH | /api/attendance/[id] | 출결 1건 수정 (per-lesson 청구 재계산 트리거) |

### 성적 · 시험 · 과제
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/exams | 시험 목록 / 등록 (반 학생 푸시) |
| PATCH·DELETE | /api/exams/[id] | 시험 수정 / 삭제 (연결 성적 포함) |
| GET·POST | /api/grades | 성적 조회 / 일괄 upsert |
| PATCH | /api/grades/[id] | 성적 점수·순위·코멘트 수정 |
| GET·POST | /api/exam-categories | 시험 카테고리 목록 / 등록 |
| DELETE | /api/exam-categories/[id] | 카테고리 삭제 (하위 포함) |
| GET·POST | /api/assignments | 과제 목록 / 등록 (반 학생 푸시) |
| PATCH·DELETE | /api/assignments/[id] | 과제 수정 / 삭제 |

### 재무
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/finance/bills | 청구서 목록 / 1건 생성 |
| GET | /api/finance/bills/months | 청구 월 distinct 목록 |
| GET | /api/finance/bills/paid-months | 납부 월 distinct 목록 |
| POST | /api/finance/bills/generate | 활성 수강생 대상 월 청구서 일괄 생성 |
| POST | /api/finance/bills/rebill | 취소 청구서 실출결 기반 재청구 (preview 지원) |
| GET | /api/finance/bills/adjustments | 학생별 청구액 조정 이력 |
| POST | /api/finance/bills/[id]/pay | 수납 처리 + 영수증 발행 |
| PATCH | /api/finance/bills/[id]/adjust | 청구액 조정 + 이력 기록 |
| POST | /api/finance/bills/[id]/cancel | 완납 청구서 취소 (토스 결제 시 취소 API 호출) |
| GET·POST | /api/finance/expenses | 지출 목록 / 등록 |
| GET·POST | /api/finance/receipts | 영수증 목록 / 수동 발행 |
| GET | /api/finance/receipts/months | 영수증 발행 월 distinct 목록 |

### 소통
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/communication/announcements | 공지 목록 / 작성 (반 지정 가능) |
| PATCH·DELETE | /api/communication/announcements/[id] | 공지 수정·게시 / 삭제 |
| GET·POST | /api/communication/consultations | 상담 목록 / 등록 |
| PATCH·DELETE | /api/communication/consultations/[id] | 상담 수정 / 삭제 |
| GET·POST | /api/communication/notifications | 알림 목록 / 발송 (수신자 레코드 생성, 푸시) |
| GET | /api/communication/notifications/months | 알림 발송 월 목록 |
| GET | /api/communication/inquiries | 공개 페이지 상담 신청 목록 |
| PATCH | /api/communication/inquiries/[id] | 상담 신청 상태·메모 수정 |
| GET | /api/communication/inquiries/months | 상담 신청 월 목록 |
| GET·POST | /api/communication/notification-templates | 알림 템플릿 목록 / 생성 |
| DELETE | /api/communication/notification-templates/[id] | 알림 템플릿 삭제 |
| GET·POST | /api/communication/report-templates | 리포트 양식 목록 / 생성 |
| PATCH·DELETE | /api/communication/report-templates/[id] | 리포트 양식 수정 / 삭제 |

### 캘린더
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/calendar | 월별 일정 조회 (보강·수업 파생 포함) / 생성 |
| PATCH·DELETE | /api/calendar/[id] | 일정 수정 / 삭제 |

### 통계
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/analytics/monthly | 최근 6개월 수납액·재원 학생 수 추이 |

### 인강
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET·POST | /api/lectures | 강의 목록 / 등록 |
| GET·PATCH·DELETE | /api/lectures/[id] | 강의 상세 / 수정 / 삭제 |
| GET·PUT·DELETE | /api/lectures/[id]/student-notes | 강의별 학생 코멘트 조회 / upsert / 삭제 |
| GET·PUT | /api/lectures/[id]/targets | 강의 수강 대상 조회 / 저장 |
| GET·POST | /api/lectures/tags | 커스텀 태그 목록 / 추가 |
| DELETE | /api/lectures/tags/[id] | 커스텀 태그 삭제 |
| POST | /api/lectures/upload-url | Cloudflare Stream 업로드 URL 발급 |
| GET·POST | /api/lecture-series | 강의 시리즈 목록 / 생성 |
| GET·PATCH·DELETE | /api/lecture-series/[id] | 시리즈 상세 / 수정 / 삭제 |
| GET·PUT·PATCH | /api/ingang/quizzes/[lectureId] | 퀴즈 조회 / 전체 저장 / 이수조건 갱신 |
| GET·POST | /api/ingang/retry | 재응시 대상·이력 조회 / 1회 허용 |

### 인강 태블릿 (tablet 전용, daily-code는 강사·원장도 허용)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/ingang-tablet/lookup | 출결번호로 학생·강의 조회, 시청 세션 생성 |
| GET·POST | /api/ingang-tablet/daily-code | 오늘 인증 코드 조회 / 즉시 재발급 |
| POST | /api/ingang-tablet/approve | 인증 코드 확인 후 시청 세션 승인 |
| GET | /api/ingang-tablet/lectures | 승인 세션 기준 강의·영상 목록 |
| POST | /api/ingang-tablet/end | 시청 세션 종료 |

### 리포트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/reports/[id] | 발행 리포트 상세 (원장·강사용) |
| GET | /api/reports/batches | 발행 묶음 단위 이력 |
| GET | /api/reports/batches/[batchId] | 묶음 내 학생별 리포트 (열람 여부 포함) |
| POST | /api/reports/preview | 시험별 리포트 미리보기 (저장 없음) |
| POST | /api/reports/preview-periodic | 정기 리포트 미리보기 (저장 없음) |
| POST | /api/reports/publish | 시험별 리포트 발행 (학생 푸시) |
| POST | /api/reports/publish-periodic | 정기 리포트 발행 (학생 푸시) |

### 모바일 PWA (parent / student 전용)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/mobile/me | 본인·자녀 프로필 + 수강반 |
| GET | /api/mobile/children | 학부모 자녀 목록 (또는 학생 본인) |
| GET | /api/mobile/grades | 성적 + 다가오는 시험·과제 |
| GET | /api/mobile/announcements | 반 공지 + 전체 공지 |
| GET | /api/mobile/calendar | 월별 일정 (보강·수업·공개) |
| GET | /api/mobile/attendance | 출결 기록 (보강 포함) |
| GET | /api/mobile/notifications | 수신 알림 목록 (1페이지 진입 시 읽음 처리) |
| GET | /api/mobile/notifications/unread-count | 미읽음 알림 수 (학부모는 자녀 합산) |
| GET | /api/mobile/reports | 발행 리포트 목록 + 미열람 수 |
| GET | /api/mobile/reports/[id] | 리포트 상세 (첫 열람 시 readAt 마킹) |
| POST·DELETE | /api/mobile/push/subscribe | 웹푸시 구독 등록 / 해제 |
| GET | /api/mobile/payments | 청구서·영수증 목록 (취소건 제외) |
| POST | /api/mobile/payments/order | 토스 결제 주문 생성·금액 검증 |
| GET | /api/mobile/payments/toss-client-key | 학원 토스 클라이언트 키 조회 |
| POST | /api/mobile/payments/toss/confirm | 토스 결제 승인 → 청구서 완납 + 영수증 |

### 키오스크
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/kiosk/session | QR 토큰·이미지 발급 (공개, IP 레이트리밋) |
| GET | /api/kiosk/recent | 최근 체크인 학생 목록 (공개) |
| POST | /api/kiosk/check-in | QR 토큰으로 출석 체크 (로그인 학생 전용) |
| GET·POST | /api/kiosk/check-in-by-number | 출결번호로 학생 조회 / 출석 체크 |

### 공개 페이지 · 웹훅 · 기타 (인증 불필요)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/academy/[slug] | 학원 공개 소개 페이지 데이터 |
| GET | /api/academy/[slug]/classes/[classId] | 공개 페이지 — 반 상세 (커리큘럼·교재) |
| POST | /api/academy/[slug]/inquiry | 공개 페이지 상담 신청 (IP 레이트리밋) |
| GET | /api/gallery-proxy | Private Vercel Blob 이미지 서빙 프록시 |
| POST | /api/webhooks/toss | 토스 결제 상태 웹훅 — HMAC-SHA256 서명 검증 |

---

## 상태 관리 (Zustand Stores)

`src/lib/stores/` — 11개:

| 파일 | 역할 |
|------|------|
| `authStore.ts` | 현재 사용자, 로그인/로그아웃, `/api/auth/me` 하이드레이션 |
| `studentStore.ts` | 학생 목록·필터, 학생 CRUD·반 배정·형제 동기화 |
| `classStore.ts` | 반 목록·일회성 수업, 반 CRUD |
| `teacherStore.ts` | 강사 목록, 등록·수정·비밀번호 초기화 |
| `attendanceStore.ts` | 출결 레코드 (학생·월별) |
| `gradeStore.ts` | 시험·성적·시험 카테고리 CRUD |
| `financeStore.ts` | 청구서·지출·영수증, 수납·조정·취소·재청구 |
| `calendarStore.ts` | 캘린더 일정 (월별 조회·CRUD) |
| `makeupStore.ts` | 보강 수업·보강 출결 |
| `communicationStore.ts` | 알림·상담·공지·문의·알림 템플릿 |
| `toastStore.ts` | 토스트 알림 큐, 전역 `toast()` 헬퍼 |

패턴: 각 store는 API에서 데이터 fetch → 로컬 state 업데이트 → 에러 처리.

---

## 공용 컴포넌트 (`src/components/shared/`)

| 컴포넌트 | 설명 |
|---------|------|
| `Button` | variant: default/dark/primary/danger/ghost · size: sm/md/lg |
| `Modal` | 오버레이 다이얼로그 (title/footer/size) |
| `Badge` | 상태 라벨 배지 (한글 상태값별 색상 매핑 내장) |
| `Avatar` | 이름 이니셜 원형 아바타 |
| `SearchInput` | 돋보기 아이콘 검색창 |
| `FilterTags` | 알약형 필터 태그 그룹 (count 배지) |
| `Tabs` | 하단 보더형 탭 네비게이션 |
| `ToastContainer` | `toastStore` 구독 토스트 렌더러 |
| `LoadingSpinner` | 로딩 스피너 (page / inline) |
| `Wordmark` | 브랜드 워드마크 "학원로그" — Pretendard 700, props: size·hakwonColor |

**디자인 토큰**:
- Primary `#1a2535` · Accent `#4fc3a1` · Border `#e2e8f0`
- Text `#111827` / Muted `#6b7280` / Faint `#9ca3af`
- Radius: card 12px / input 10px / button 8px
- Base font: 13px · Header height: 50px

**인강 전용 테마** (보라색 사이드바):
- BG `#1e1b2e` · Accent `#a78bfa` · Sub-accent `#5B4FBE` · Highlight `#EEEDFE`

**브랜드 워드마크 "학원로그"**:
- "학원"(`#e5e7eb`, 밝은 배경에선 진한 색) + "로그"(`#34d399`), Pretendard 700, letter-spacing −0.045em
- Pretendard는 `src/app/layout.tsx`에서 jsDelivr CDN으로 로드
- `<Wordmark size={px} hakwonColor="#..." />` 컴포넌트로 사용

---

## 개발 현황

### Phase A–B (완료)
- [x] 전체 UI 프로토타입 (모든 페이지 레이아웃 + mock 데이터)
- [x] JWT 인증 + httpOnly 쿠키
- [x] Next.js 16 proxy (역할별 접근 제어, 헤더 주입)
- [x] Prisma 7 + PostgreSQL (Neon) 연동
- [x] DB 시드 데이터 (학원 1개, 학생 20명, 반 5개, 강사 3명)
- [x] 슈퍼어드민: 학원 목록·등록·상세·계정 관리·비밀번호 변경
- [x] Toast 알림 시스템
- [x] 학생 등록 모달, 출결번호 연도+순번 형식
- [x] 형제/자매 자동 감지 (보호자 번호 일치 시 연결 제안)
- [x] 성적/시험 DB 연동

### Phase C (완료)
- [x] 반 관리 고도화: 반 CRUD, 월별 캘린더 시간표, 수강 등록/해제
- [x] 커리큘럼·보강·강사 관리
- [x] 출결 현황·학생 리포트 페이지 개선
- [x] 전 도메인 DB API 전환 (학생·반·출결·재무·소통·캘린더·성적)
- [x] 모바일 PWA API 일부
- [x] Vercel 배포

### Phase D (완료) — 모바일 PWA 실제 데이터 연동
- [x] JWT 인증 기반 모바일 API (`me`·`attendance`·`payments`·`schedule`·`notifications`)
- [x] 모바일 페이지 하드코딩 → 실제 DB 조회
- [x] 역할 분기: student(직접 조회) / parent(자녀 연결 조회)
- [x] 시드 loginId 형식 확정: `학원키 + 출석번호`

### Phase E (완료) — 토스페이먼츠 결제 + 학원 공개 페이지
- [x] 토스페이먼츠 인앱 결제 (주문 → 결제창 → confirm → Bill PAID + Receipt)
- [x] `PaymentOrder` 모델로 `orderId ↔ billIds` 매핑
- [x] 결제 성공/실패 페이지
- [x] 학원별 공개 소개 페이지 `/academy/[slug]`
- [x] Vercel Blob 갤러리 이미지 업로드
- [x] 슈퍼어드민 → 학원별 토스 키 등록 (AES-256-GCM 암호화)

### Phase F (완료) — 인강 DB 연동 + Cloudflare Stream
- [x] DB 모델: `Lecture`·`LectureTarget`·`AcademyTag`
- [x] API CRUD: `/api/lectures/*`, 커스텀 태그
- [x] Cloudflare Stream Direct Creator Upload (`tus-js-client`)
- [x] 강의 카드 그리드·등록 폼·태그 관리·수강대상 지정

### Phase G (완료) — 인강 고도화 · 리포트 · 운영 기능
- [x] 인강 시청 인증 (태블릿): `IngangViewSession`·`IngangDailyCode` — 출결번호 조회 → 일일코드 강사 승인 → 시청 → 종료
- [x] 인강 시험 출제·응시·자동 채점: `LectureQuiz`·`LectureQuestion`·`LectureQuestionOption`·`LectureQuizAttempt`
- [x] 인강 시험 재응시 허용: `LectureRetryPermission`
- [x] 강의 시리즈(`LectureSeries`)·개별 학생 수강대상(`LectureStudentTarget`)·강의별 학생 코멘트(`StudentLectureNote`)
- [x] 성적 리포트: `ReportTemplate`·`Report` — 시험별/정기 양식·미리보기·발행 (브라우저 인쇄 PDF)
- [x] 과제 관리(`Assignment`), 시험 카테고리 계층(`ExamCategory`)
- [x] 청구액 조정 이력(`BillAdjustment`), 청구 취소·재청구
- [x] 일회성 수업 일정(`ClassEvent`)
- [x] 웹푸시 알림(`PushSubscription`, VAPID) — 공지·과제·시험·리포트 발행 시
- [x] 키오스크 QR / 출결번호 출석 (실 데이터 연동)
- [x] SMS 발송(Solapi) — 계정 생성·비밀번호 초기화 시 임시 비밀번호
- [x] 감사 로그(`AuditLog`), 비밀번호 이력(`PasswordHistory`), 계정 잠금·레이트리밋
- [x] 브랜드 리뉴얼: HwLog → **학원로그** 워드마크 (Pretendard)

### 향후 과제 (미구현)
- [ ] 이수증 PDF 발급 — `ingang/completion/stats`·`notifications` 페이지는 아직 목업
- [ ] 인강 시청 현황 대시보드 — `ingang/completion` 페이지 목업 (실 데이터 미연동)
- [ ] 정산서 PDF 출력 — `finance/settlement` 다운로드 버튼 목업
- [ ] 구 인강 시험 페이지(`ingang/exams`) 목업 잔존 — 신규 `lectures/targets` 탭으로 대체됨
- [ ] 카카오 알림톡 발송 (비즈채널 + 대행사 계약)
- [ ] NestJS 백엔드 마이그레이션 (장기 계획)

---

## 토스페이먼츠 학원 등록 절차 (운영 가이드)

새 학원이 토스페이먼츠 결제를 사용하려면 아래 3단계를 완료해야 합니다.

### 1단계 — 토스페이먼츠 상점 계정 발급 (학원 자체 진행)

1. [토스페이먼츠 홈페이지](https://www.tosspayments.com) → **사업자 가입**
2. 사업자등록증·계좌 정보 제출 후 심사 (영업일 1~3일)
3. 심사 통과 시 **대시보드** 발급
4. 대시보드 → **개발 연동** → API 키 메뉴에서 2가지 키 복사:
   - **Client Key** (`test_ck_...` 또는 `live_ck_...`)
   - **Secret Key** (`test_sk_...` 또는 `live_sk_...`)
   > ⚠️ `test_` 키로 먼저 테스트 후 운영 전환 시 `live_` 키로 교체

### 2단계 — 슈퍼어드민 페이지에서 키 등록

1. 슈퍼어드민 계정으로 로그인 → `/super-admin` 이동
2. 해당 학원 상세 클릭
3. **토스페이먼츠 결제 키** 섹션에서 Client Key·Secret Key 입력 후 **저장**
   > Secret Key는 AES-256-GCM으로 암호화되어 DB에 저장됩니다. 원문은 저장되지 않습니다.
4. **웹훅 URL**을 복사합니다:
   ```
   https://hw-log.co.kr/api/webhooks/toss?academyId=<학원ID>
   ```

### 3단계 — 토스페이먼츠 대시보드에서 웹훅 URL 등록

> 웹훅은 **학부모가 결제 직후 브라우저를 닫거나 네트워크가 끊겨도** 서버가 결제 완료를 수신하기 위해 필수입니다.

1. 토스페이먼츠 대시보드 → **개발 연동** → **웹훅**
2. **웹훅 추가** → 위 URL 붙여넣기
3. 이벤트: **`PAYMENT_STATUS_CHANGED`** 체크 → **저장**

> 학원마다 academyId가 다르므로 URL이 다릅니다. 학원별로 각각 등록해야 합니다.

### 키 환경 주의사항

| 키 접두사 | 환경 | 실제 결제 여부 |
|-----------|------|---------------|
| `test_ck_` / `test_sk_` | 테스트 | ❌ 결제 미발생 (카드 테스트 번호 사용) |
| `live_ck_` / `live_sk_` | 운영 | ✅ 실제 결제 발생 |

> Client Key와 Secret Key는 반드시 **같은 환경**의 키 쌍을 사용해야 합니다. 시크릿 키 암호화에는 서버 환경 변수 `TOSS_KEY_ENC_SECRET`이 사용됩니다.

---

## 결제 플로우 (토스페이먼츠)

```
모바일 알림/수납 → "결제하기"
  ↓ POST /api/mobile/payments/order (billIds 검증, 금액 서버 확인, PaymentOrder 생성)
  ↓ GET /api/mobile/payments/toss-client-key (학원별 클라이언트 키)
  ↓ 토스 SDK requestPayment()
  ↓ 결제 완료 → /mobile/payments/success?paymentKey=&orderId=&amount=
  ↓ POST /api/mobile/payments/toss/confirm (Toss API 승인 → Bill PAID, Receipt 생성)
  ↓ (백업) POST /api/webhooks/toss — 결제 상태 웹훅으로 완납 보정
```

### 취소 / 재청구 플로우

```
관리자 → 청구/수납 → 완납 청구서 → [취소]
  ↓ POST /api/finance/bills/[id]/cancel
  ↓ 토스 결제건: Toss 취소 API 호출 → 동일 주문 청구서 전체 CANCELLED
  ↓ 수동 수납건: 해당 청구서만 CANCELLED, 연결 영수증 cancelledAt 기록

취소 청구서 → [재청구]
  ↓ POST /api/finance/bills/rebill
  ↓ 실출결 기준 자동 계산액 표시 (원장 수정 가능)
  ↓ 새 UNPAID 청구서 생성 (원본 취소 청구서와 연결)
  ↓ 학부모 앱에 "취소 후 재청구" 알림 발송 (선택)
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
강의 등록 폼 "외부 영상 URL"에 YouTube Embed URL 직접 입력
  → videoUrl 저장 → 재생: <iframe src={videoUrl}> (cfVideoId 없을 때 fallback)
  → 형식: https://www.youtube.com/embed/{VIDEO_ID}
```

> **Cloudflare Stream 주의**: 무료 tier는 업로드 불가. $5/월 1,000분 플랜 이상 필요. 유료 플랜 사용 전에는 "외부 영상 URL"에 YouTube Embed URL을 사용하세요. `cfVideoId`가 `videoUrl`보다 우선 재생됩니다.

---

## 웹푸시 · SMS

- **웹푸시(PWA)**: `web-push` + VAPID. 학생/학부모가 모바일 앱에서 구독(`POST /api/mobile/push/subscribe`) → `PushSubscription` 저장 → 공지·과제·시험·리포트 발행 시 `src/lib/push/sendPush.ts`로 발송. 서비스 워커 `public/sw.js`가 수신·표시. iOS는 16.4+ 홈 화면 추가 시 지원.
- **SMS**: Solapi REST API (`src/lib/sms/solapi.ts`). 학생·강사 계정 생성, 비밀번호 초기화 시 임시 비밀번호를 `[학원로그]` 머리말과 함께 발송.

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
- datasource URL·seed 커맨드: `schema.prisma`가 아닌 `prisma.config.ts`에서 관리

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
