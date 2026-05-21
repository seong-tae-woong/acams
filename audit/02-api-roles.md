# 02. API role 가드 누락 점검

> SECURITY.md #2 ("일부 쓰기 API에 role 검증 없음") 의 **전수 조사** 결과.
> 쓰기 핸들러(POST/PATCH/PUT/DELETE) + requireAuth 사용 + role 가드 미사용 = **62개 라우트**.

---

## 핵심 결정 사항 (PR 전에 결정 필요)

> 본 점검은 "role 검증 없음" 사실만 보고한다. **의도된 권한**인지(teacher가 학생 등록 가능 등) 또는 **누락된 가드**인지는 비즈니스 결정. 아래 분류는 _권장_ 이다.

| 분류 | 권장 가드 | 개수 |
|------|----------|:---:|
| A. 재무·운영 (반드시 director+) | `role === 'director' \|\| 'super_admin'` | 16 |
| B. 학사 운영 (teacher도 가능 의도 의심) | director · teacher 명시 | 22 |
| C. 학생·학부모도 가능 (의도 확인) | role 가드 없는 게 의도일 가능성 | 14 |
| D. tablet 전용 (proxy에서 이미 통제) | proxy.ts 이중 가드라 OK | 10 |

---

## A. 🚨 재무·운영 (1순위 — director 이상으로 제한 권장)

> teacher 계정 탈취 시 학원의 **신뢰·금전 손실** 직결. 가장 시급.

| 라우트 | 메서드 | 가드 현황 | 위험 |
|--------|--------|----------|------|
| [`src/app/api/finance/bills/route.ts`](../src/app/api/finance/bills/route.ts) | POST | ❌ | 청구서 단건 생성 |
| [`src/app/api/finance/bills/generate/route.ts`](../src/app/api/finance/bills/generate/route.ts) | POST | ❌ | 청구서 **일괄** 생성 |
| [`src/app/api/finance/bills/[id]/adjust/route.ts`](../src/app/api/finance/bills/[id]/adjust/route.ts) | PATCH/POST | ❌ | 청구서 조정 |
| [`src/app/api/finance/bills/[id]/pay/route.ts`](../src/app/api/finance/bills/[id]/pay/route.ts) | POST | ❌ | 청구서 수납 |
| `src/app/api/finance/bills/[id]/cancel/route.ts` | POST | ⚠️ 1개 (확인 필요) | 청구서 취소 |
| `src/app/api/finance/bills/rebill/route.ts` | POST | ❌ | 청구서 재발행 |
| `src/app/api/finance/bills/adjustments/route.ts` | POST | ❌ | 조정 내역 |
| `src/app/api/finance/expenses/route.ts` | POST/PATCH/DELETE | ❌ | 지출 관리 |
| `src/app/api/finance/receipts/route.ts` | POST | ❌ | 영수증 발행 |
| `src/app/api/communication/announcements/route.ts` | POST | ❌ | 학원 공지 게시 |
| `src/app/api/communication/announcements/[id]/route.ts` | PATCH/DELETE | ❌ | 공지 수정·삭제 |
| `src/app/api/communication/notifications/route.ts` | POST | ❌ | 알림 발송 |
| `src/app/api/communication/notification-templates/route.ts` | POST | ❌ | 템플릿 관리 |
| `src/app/api/communication/notification-templates/[id]/route.ts` | PATCH/DELETE | ❌ | 템플릿 관리 |
| `src/app/api/teachers/route.ts` | POST | ❌ | 강사 추가 |
| `src/app/api/teachers/[id]/route.ts` | PATCH/DELETE | ❌ | 강사 수정·삭제 |
| `src/app/api/teachers/[id]/reset-password/route.ts` | POST | ❌ | 강사 비밀번호 리셋 ⚠️ |

### 권장 패치 (라우트 상단에 1줄)

```typescript
const auth = await requireAuth(req);
if (auth instanceof NextResponse) return auth;
const { academyId, userId, role } = auth;

// ↓ 추가
if (role !== 'director' && role !== 'super_admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**일괄 작업 추천**: 위 17개 라우트 한 PR로 묶어 적용. 각 라우트 수정량은 3-4줄.

---

## B. 학사 운영 (2순위 — teacher 허용 의도 의심, 명시 권장)

> 강사가 출결·성적·과제 입력은 일상 업무. **명시적으로 teacher 허용** 표시만 추가.

| 라우트 | 권장 가드 |
|--------|----------|
| `src/app/api/students/route.ts` (POST) | director · teacher (의도 확인 필요 — 학생 등록을 강사가?) |
| `src/app/api/students/[id]/route.ts` (PATCH/DELETE) | director · teacher (의도 확인) |
| `src/app/api/students/[id]/reset-password/route.ts` (POST) | director · teacher |
| `src/app/api/students/[id]/siblings/route.ts` | director · teacher |
| `src/app/api/classes/route.ts` (POST) | director (반 생성·삭제는 원장 권한이 의도?) |
| `src/app/api/classes/[id]/route.ts` (PATCH/DELETE) | director |
| `src/app/api/classes/[id]/curriculum/route.ts` | director · teacher |
| `src/app/api/classes/[id]/curriculum/[rowId]/route.ts` | director · teacher |
| `src/app/api/classes/[id]/textbooks/route.ts` | director · teacher |
| `src/app/api/classes/[id]/textbooks/[tbId]/route.ts` | director · teacher |
| `src/app/api/attendance/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/grades/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/exams/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/exam-categories/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/assignments/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/lessons/comments/route.ts` | director · teacher |
| `src/app/api/lessons/clinic-templates/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/lessons/clinic-results/route.ts` | director · teacher |
| `src/app/api/makeup/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/makeup/comments/route.ts` | director · teacher |
| `src/app/api/makeup/clinic-results/route.ts` | director · teacher |
| `src/app/api/class-events/route.ts` | director · teacher |
| `src/app/api/calendar/route.ts` | ✅ 이미 적용됨 (line 132-134) — director · teacher · admin |
| `src/app/api/calendar/[id]/route.ts` | (확인) |
| `src/app/api/communication/consultations/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/communication/inquiries/[id]/route.ts` (PATCH 답변) | director · teacher |
| `src/app/api/communication/report-templates/route.ts`, `[id]/route.ts` | director · teacher |
| `src/app/api/reports/publish/route.ts`, `publish-periodic/route.ts` | director · teacher |
| `src/app/api/reports/batches/route.ts`, `[batchId]/route.ts` | director · teacher |
| `src/app/api/reports/[id]/route.ts` | director · teacher |
| `src/app/api/settings/academy/route.ts` (PATCH) | director only ⚠️ |
| `src/app/api/settings/gallery/route.ts` | director only ⚠️ |
| `src/app/api/settings/tablets/route.ts`, `[id]/route.ts` | director only |
| `src/app/api/lectures/*` 전체 | director · teacher (의도 확인) |
| `src/app/api/lecture-series/*` | director · teacher |

---

## C. 학생·학부모도 호출 가능 (의도 확인만)

| 라우트 | 메모 |
|--------|------|
| `src/app/api/mobile/payments/order/route.ts` | parent · student (자신 청구만) |
| `src/app/api/mobile/payments/toss/confirm/route.ts` | parent · student |
| `src/app/api/mobile/push/subscribe/route.ts` | 모든 인증 사용자 |
| `src/app/api/auth/me/route.ts` | 모든 인증 사용자 |
| `src/app/api/auth/change-password/route.ts` | 모든 인증 사용자 |
| `src/app/api/auth/logout/route.ts` | 모든 인증 사용자 |

→ **role 가드 불필요** (모바일은 parent/student 본인 데이터만 select 함). 단 `where: { studentId: ownStudentId }` 격리 검증을 06-mobile-pwa-payments.md에서 별도 확인.

---

## D. tablet 전용 (proxy에서 이미 차단)

[`src/proxy.ts:102-112`](../src/proxy.ts) 에서 비-tablet 계정의 `/api/ingang-tablet/*` 접근 차단(`daily-code` 제외). 따라서 라우트 핸들러 내 role 가드 불필요.

해당 라우트:
- `src/app/api/ingang-tablet/lookup/route.ts`
- `src/app/api/ingang-tablet/approve/route.ts`
- `src/app/api/ingang-tablet/end/route.ts`
- `src/app/api/ingang-tablet/lectures/route.ts`
- `src/app/api/ingang-tablet/progress/route.ts`
- `src/app/api/ingang-tablet/quiz/start/route.ts`
- `src/app/api/ingang-tablet/quiz/submit/route.ts`
- `src/app/api/ingang-tablet/daily-code/route.ts` (teacher · director 도 OK)

> 단 lookup·approve·end는 라우트 내부에서 명시적 `role === 'tablet'` 가드 추가됨 (이중 방어).

---

## 작업 분할 권장

### Step 1 (가장 시급, 1 PR)
A 섹션 17개 라우트에 `director / super_admin` 가드 일괄 추가.

### Step 2 (의도 확인 후, 1 PR)
B 섹션 라우트에 `director / teacher` 가드 일괄 추가.
- ⚠️ 먼저 결정 필요: "학생 등록·반 생성을 강사도 할 수 있어야 하나?"
- 안 된다면 일부는 director only.

### Step 3 (선택)
- API 라우트별로 role 검증을 함수로 추출: `requireRole(auth, ['director', 'teacher'])` 도입
- 새 라우트 추가 시 누락 방지

---

## 검증 명령 (작업 후 회귀 확인)

```bash
# role 가드 없는 쓰기 API 카운트 (목표: 0 또는 의도된 14개)
for f in $(find src/app/api -name "route.ts"); do
  if grep -qE "(POST|PATCH|PUT|DELETE)" "$f" \
     && grep -q "requireAuth" "$f" \
     && ! grep -qE "role\s*[!=]==?" "$f"; then
    echo "$f"
  fi
done | wc -l
```

현재: **62개**. Step 1 후 목표: **~45개**. Step 2 후 목표: **~14개 (의도된 것만)**.
