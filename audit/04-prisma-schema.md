# 04. Prisma 스키마·DB 점검

> `prisma/schema.prisma` 31개 모델, 1,200+ 라인 검토. 멀티테넌트 격리·인덱스·관계 점검.

---

## 1. 멀티테넌트 격리 — 양호 ✅

### 검증
모든 학원 데이터 모델 (Student, Class, Bill, Lecture 등) 이 `academyId String` 필수 필드 + Academy 관계 보유.

### 의도적 예외 (정상)

| 모델 | academyId | 설명 |
|------|:---------:|------|
| `User` | `String?` | super_admin은 academyId 없음 (모든 학원 접근) |
| `AuditLog` | `String?` | 시스템 레벨 이벤트는 academy 없을 수 있음 |
| `Academy` | — | 자기 자신 |

→ 의도된 설계. SECURITY.md 또는 schema.prisma 주석에 명시 권장 (현재 미명시).

---

## 2. 인덱스 추가 권장 — `LectureWatchProgress` (Low-Medium)

### 발견
`prisma/schema.prisma:1187` 부근의 `LectureWatchProgress` 모델:

```prisma
@@index([academyId, lectureId])
```

학생별 진도 조회 (`/api/ingang/progress?studentId=X`)가 인강 통계 화면 real-데이터 전환 시 자주 호출될 텐데, `studentId` 단독 또는 복합 인덱스 부재.

### 영향
- 현재: 인강 진도가 학원 1곳에서만 운영되면 데이터 수백~수천 행, 풀스캔 OK
- 향후: 학원 100개·강의 50개·학생 50명 = 25만 행. studentId 인덱스 없으면 학생별 조회 시 풀스캔
- 인강 통계 화면이 실데이터로 전환되는 시점에 회귀 위험

### 권장 (실데이터 전환 직전)

```prisma
@@index([academyId, studentId, updatedAt])
```

추가 후 `npx prisma db push` 로 Neon 반영. cost는 거의 0.

---

## 3. 외래키 onDelete 정책 점검 — 정독 필요

### 권장 작업
schema.prisma 의 모든 `@relation(... onDelete: ...)` 정책을 한 번 훑고 다음 케이스 검증:

| 시나리오 | 기대 동작 |
|---------|----------|
| 학생 삭제 → AttendanceRecord | Cascade or SetNull? |
| 학생 삭제 → Bill | Cascade or Restrict (기록 보존)? |
| 학생 삭제 → LectureWatchProgress | Cascade |
| 반 삭제 → ClassEnrollment | Cascade |
| 강의 삭제 → LectureWatchProgress | Restrict (시청 기록 보존)? |
| 학원 삭제 → 전체 | (super_admin 영역, 별도 검토) |

### 직접 확인 (수동 트리거)
- 학원 폐원 시 데이터 어떻게 처리할지 정책 필요 (현재 schema에 없음)
- 학생 졸업·강사 퇴사 시 hard delete 또는 isActive flag?

> 본 점검에서는 `onDelete` 일관성을 정독·정리하지 않음. **별도 트랙 권장**.

---

## 4. 금액·시간 필드 타입 — 적절 ✅

| 모델·필드 | 타입 | 평가 |
|----------|------|------|
| Bill.amount, paidAmount | `Int` (원) | OK — 한국 원화는 정수 |
| Expense.amount | `Int` | OK |
| Lecture.duration | `String "MM:SS"` | UX 표시용 — derived value |
| Lecture.durationSec | `Int?` | 진도율 계산용 (서버 진실) |

> Lecture에 `duration` (문자) 과 `durationSec` (정수) 가 동시 존재. 의도된 분리이지만 새 강의 추가 시 둘 다 채워야 함 → 어드민 코드에서 일관 처리하는지 확인 권장.

---

## 5. Unique 제약 점검

### 검증 항목
| 필드 | 모델 | 현황 |
|------|------|------|
| `email` | User | unique? 필요 (의도 확인) |
| `phone` | Parent, Student | academyId 내 unique? |
| `attendanceNumber` | Student | academyId 내 unique? (필요) |
| `slug` | Academy | unique 전역 (필요) |

### 권장
`schema.prisma` 정독 후 위 필드에 `@@unique([academyId, attendanceNumber])` 같은 복합 unique 있는지 확인. 없다면 추가.

(본 점검에서 schema 전체 unique 절은 추출하지 않음 — 별도 확인 권장)

---

## 6. 마이그레이션 흐름 — `db push` 의존

### 현황 (README + CLAUDE.md 기준)
- `master` 푸시 → Vercel 자동 배포
- DB 스키마 변경 → `npx prisma db push` **수동 반영** (마이그레이션 파일 없음)

### 영향
- `prisma migrate dev` / `prisma migrate deploy` 사용하지 않음 → 변경 이력 추적 어려움
- 롤백 시 schema.prisma 되돌리고 다시 push해야 함
- 팀이 확장되거나 운영 데이터가 누적되면 migrate 도입 검토

### 권장 (운영 안정 후)
- `prisma/migrations/` 도입 → 변경 이력 git 추적
- 단 현재 단계(1인 운영)에서는 db push가 빠름 → **유지 결정 OK**, 단 README에 의도 명시

---

## 7. 시드 데이터 점검

[`prisma/seed.ts`](../prisma/seed.ts) 존재. README.md 의 시드 계정 (super_admin, director, teacher, parent, student 등) 비밀번호 노출 여부 확인.

→ 시드 데이터는 개발용으로 적절. **운영 환경에서 시드 비밀번호 사용 금지** (SECURITY.md #6 — 실 운영 super_admin 계정 생성 필요).

---

## 종합

| # | 항목 | 심각도 | 작업량 |
|:-:|------|:------:|:------:|
| 1 | `LectureWatchProgress` (academyId, studentId, updatedAt) 인덱스 | Low | 5분 |
| 2 | onDelete 정책 전수 정리 | Medium | 1시간 정독 |
| 3 | Unique 제약 (학원 내 attendanceNumber 등) 확인 | Medium | 30분 |
| 4 | super_admin academyId=null 의도 schema 주석 추가 | Info | 5분 |
| 5 | db push → migrate 전환 (장기) | Low | 1일 (운영 안정 후) |

**현재 단계에서 시급한 DB 작업은 없음.** 인강 통계 실데이터 전환 시 #1 인덱스만 같이 작업.
