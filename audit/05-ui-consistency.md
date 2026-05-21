# 05. UI 일관성·디자인 토큰

> 55개 UI 페이지 + 33개 컴포넌트. 디자인 토큰 위반·공용 컴포넌트 사용·빈 상태 처리 점검.

---

## 1. 공용 컴포넌트 사용 — 양호 ✅

CLAUDE.md §4 의 공용 컴포넌트 (`src/components/shared/Button`, `Modal`, `Badge`, `Avatar`, `SearchInput`, `FilterTags`, `Tabs`, `ToastContainer`) 가 도메인별 페이지에서 일관 사용됨.

> 본 점검에서는 모든 페이지를 정독하지 않음. 의심 신호 (직접 `<button>` 남용 등)는 [Sec 4](#4-페이지별-점검-한계) 참고.

---

## 2. 디자인 토큰 위반 — 하드코딩 색상 (Low-Medium)

### CLAUDE.md §4 토큰
- primary `#1a2535`
- accent `#4fc3a1`
- border `#e2e8f0`
- text `#111827` / muted `#6b7280` / faint `#9ca3af`
- 인강 영역(§6): bg `#1e1b2e`, accent `#a78bfa`

### 발견 (sub-agent 점검 기반)

| 파일 | 라인 | 색상 | 의견 |
|------|:----:|------|------|
| `src/app/(admin)/students/attendance/page.tsx` | 110-113 | `#065f46`, `#991B1B` 등 | 출결 상태 색상 (의도된 상태 시각화일 가능성) |
| `src/app/mobile/payments/page.tsx` | 164 | `#4fc3a1` inline | accent 토큰 값이지만 inline style 사용 |

### 평가
- **하드코딩 색상이 다 나쁜 건 아님** — 출결 상태(PRESENT 녹색 / ABSENT 빨강) 같은 의미 색상은 토큰 외 추가가 자연스러움
- 다만 **inline style 보다는 Tailwind 클래스 또는 CSS 변수** 권장

### 권장 (Low — 미관상 부채)

옵션 1) `tailwind.config` 에 상태 색상 토큰 추가:
```typescript
theme: {
  extend: {
    colors: {
      'status-present': '#065f46',
      'status-absent': '#991B1B',
      'status-late': '#92400E',
    }
  }
}
```

옵션 2) `globals.css` 에 CSS 변수로 정의:
```css
:root {
  --color-status-present: #065f46;
  --color-status-absent: #991B1B;
}
```

> **참고**: 사용자 메모리에 "미관상 대규모 churn은 회피" 가 기록되어 있음. 토큰화 작업은 새 기능 개발 시 함께 점진적으로 도입 권장. **별도 PR로 색상만 일괄 치환은 비추**.

---

## 3. `<img>` vs `next/image` — 5건 (Low)

| 위치 | 평가 |
|------|------|
| `src/app/(admin)/settings/_tabs/ProfileTab.tsx:263` | 학원 갤러리 사진 — OK (관리자 화면, 동적 URL) |
| `src/app/academy/[slug]/page.tsx:179,611,635` | 학원 공개 페이지 갤러리 — **LCP 영향** 가능, next/image 검토 |
| `src/app/kiosk/page.tsx:422` | QR 코드 이미지 (data URL) — OK (정적 데이터 URL) |

### 권장
- `src/app/academy/[slug]/page.tsx` 의 학원 공개 페이지는 **마케팅 / 학부모 첫 접점**이므로 next/image 로 전환 시 LCP 개선
- 단 next/image 는 도메인 등록 (`next.config.images.remotePatterns`) 필요. Vercel Blob URL 도메인 등록 작업 발생
- **공수 vs ROI**: 학원 공개 페이지 트래픽이 적으면 후순위

---

## 4. 빈 상태(Empty State) 처리 — 점검 한계

### 발견
sub-agent 점검에서 `announcements/page.tsx` 의 빈 상태 메시지 부재 의심 제기.

### 한계
55개 페이지 모두 빈 상태를 자동 점검할 수 없음. **수동 QA 필요**.

### 권장 (브라우저 QA 작업)
다음 시나리오 직접 클릭 테스트:
1. 신규 학원 (학생 0명, 반 0개, 청구 0건) 시드로 로그인 후 모든 관리자 페이지 순회
2. 각 페이지에서 "데이터 없음" 메시지가 자연스러운지
3. 페이지 깨짐 / undefined 표시 없는지

→ TODOS.md #7 (vitest + integration test) 도입 시 함께 자동화 가능.

---

## 5. 반응형·모바일 점검 — 점검 한계

### 한계
정적 코드 점검으로는 다음을 검증할 수 없음:
- 모바일 뷰포트 (375×812) 에서 레이아웃 깨짐
- 다크모드 (현재 없음? 확인 필요)
- 학원 공개 페이지의 갤러리 스와이프 동작

### 권장
사용자가 실제 모바일에서 PWA 설치 후 5탭 순회 1회.

---

## 6. 접근성(a11y) — 점검 미수행

본 점검에서 다음 항목 미점검:
- `alt` 텍스트 누락
- 키보드 네비게이션 (Tab 키 흐름)
- aria-label
- 색상 대비 (WCAG)

→ 별도 트랙. 우선순위 낮음 (학원 SaaS 특성상 키보드 사용자 적음).

---

## 종합

| # | 항목 | 심각도 | 권장 |
|:-:|------|:------:|------|
| 1 | 디자인 토큰 추가 (상태 색상) | Low | 새 기능 추가 시 점진적 |
| 2 | 학원 공개 페이지 next/image 전환 | Low | LCP 측정 후 결정 |
| 3 | 빈 상태 메시지 수동 QA | Medium | 신규 학원 시나리오 1회 점검 |
| 4 | 반응형 모바일 PWA 점검 | Medium | 사용자 디바이스 직접 점검 |

**시급한 UI 이슈는 없음.** 디자인 시스템 정비는 다음 메이저 작업 묶음에 포함 권장.
