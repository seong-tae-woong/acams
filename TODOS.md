# TODOS

> 본 PR 범위 밖이지만 추적해두고 싶은 작업들.
> **2026-05-21 업데이트**: 전반 점검(audit/) 완료. 보안 Pack A+B+C 작업 반영. 신규 항목 8~13 추가.

## AI Agent (별도 기획 문서)

> 추후 개발 예정. 상세 계획·검증 절차·폐기 카드 기록은 프로젝트 루트의 **`AI Agent 개발.md`** 참고.
> 핵심 2장: ① OMR 표준 답안지 + 자동 채점 + 약점 분석 ② 인강 영상 자동 챕터·요약. 본격 착수 전 원장 인터뷰·spike 선행 필요.

## 인강·이수 (priority 묶음)

### 1. 모바일 인강 시청 지원 (P2)
- **무엇**: 학생이 집에서 모바일 PWA로 인강을 보고 진도가 동기화되는 흐름.
- **왜**: 현재는 학원 비치 태블릿 전용. 가정 시청 수요는 별도 트랙.
- **현재 상태**: `LectureWatchProgress` 모델은 재사용 가능하나 인증 패턴이 다름 (parent/student vs tablet).
- **출발점**: `src/app/api/mobile/` 하위에 `lectures/` 추가, `src/app/mobile/`에 시청 페이지 신설.
- **선행 조건**: 본 PR이 진도율 모델·progress API 안정 운영 1개월 후.
- **Effort**: M (human ~3일 / CC ~3시간)

### 2. 자동 부정시청 패턴 감지 (P3)
- **무엇**: 같은 학생이 1시간에 N강 완강 같은 비현실적 패턴을 자동 감지·차단·관리자 알림.
- **왜**: 본 PR의 갭 룰·서버 권위 delta는 1차 방어. 패턴 기반 2차 방어는 별도.
- **선행 조건**: 데이터 1~2개월 누적 후 baseline 학습.
- **Effort**: M (human ~2일 / CC ~2시간)

### 3. AI 자동 문제 출제 (P3)
- **무엇**: 강의 영상/스크립트 기반으로 LLM이 객관식 문제 자동 출제. 원장이 수정 후 확정.
- **왜**: 현재 ExamContent.tsx는 수동 출제. 강의 늘면 운영 부담 큼.
- **출발점**: Cloudflare Stream의 자막 추출 + LLM API 호출 + LectureQuestion 자동 생성 초안.
- **Effort**: L (human ~1주 / CC ~1일)

### 4. 이수증 자동 발급/PDF (P2)
- **무엇**: `LectureWatchProgress.completedAt + LectureQuizAttempt.isPassed=true` 학생 대상 이수증 PDF 자동 생성.
- **왜**: 학원로그 차별화 요소. 현재 `이수증 발급` 페이지는 mockup.
- **출발점**: 본 PR로 데이터 인프라는 완성. `이수증 발급` 페이지 + PDF 생성 라이브러리 + 다운로드/이메일 발송.
- **선행 조건**: 본 PR 완료 + 이수증 디자인 합의.
- **Effort**: M (human ~3일 / CC ~3시간)

### 5. 재응시 전 영상 재시청 강제 정책 옵션 (P3)
- **무엇**: 강의별로 "시험 불합격 후 재응시 전 영상을 다시 100% 봐야 한다" 옵션 추가.
- **왜**: design doc의 Open Question. 현재는 영상 재시청 불필요로 출발.
- **출발점**: `LectureQuiz`에 `requireRewatchOnRetry: Boolean` 추가, attempt 생성 시 isPassed=false면 watchedSeconds=0 리셋.
- **Effort**: S (human ~3시간 / CC ~30분)

## 인프라·운영

### 6. localStorage 진도 큐 영속화 (P3)
- **무엇**: 본 PR의 메모리 큐를 localStorage 백업하여 태블릿 새로고침 시 손실 방지.
- **왜**: 현재 메모리 큐는 5~30초 손실은 허용이지만 새로고침 시 전부 손실.
- **Effort**: S (human ~2시간 / CC ~20분)

### 7. 자동화 테스트 인프라 도입 (P2)
- **무엇**: vitest + Prisma test 환경 + 핵심 API (인증·재무·인강 게이트) integration 테스트.
- **왜**: 현재 수동 QA 의존. 인강 게이트는 정책성 코드라 회귀 위험 큼.
- **현재 상태**: package.json에 테스트 러너 의존성 0.
- **출발점**: vitest 설치 + `test/api/` 폴더 + 인강 progress API 1개 test 케이스.
- **Effort**: M (human ~3일 / CC ~4시간)

## 보안·운영 (audit/에서 도출, 2026-05-21)

### 8. ~~API role 가드 일괄 추가~~ ✅ 2026-05-21 완료
재무·운영·강사 관련 13개 쓰기 핸들러에 `director / super_admin` 가드 추가. 상세: `audit/02-api-roles.md`.

### 9. ~~보안 헤더 추가~~ ✅ 2026-05-21 완료
`next.config.ts`에 HSTS·X-Frame-Options 등 5종 추가. 상세: `audit/01-security.md §1`.

### 10. ~~키오스크 recent 토큰 검증~~ ✅ 2026-05-21 완료
`/api/kiosk/recent` academyId query string 제거 → x-kiosk-token JWT 검증. 상세: `audit/03-multitenant-kiosk.md`.

### 11. ~~인강 mockup 페이지 배너~~ ✅ 2026-05-21 완료
exams·completion·stats·notifications 4페이지에 "샘플 데이터" amber 배너 추가.

### 12. ~~학사 운영 API role 가드 명시~~ ✅ 2026-05-21 완료
비즈니스 결정: 강사 포함. 학사 일상 교무(출결·성적·과제·수업이력·보강·리포트·인강 등) → director·teacher 가드. 학생 등록·반 생성·설정 → director only 가드. 총 38개 핸들러 일괄 추가.

### 13. Upstash Redis rate limit 전환 (P3)
- **무엇**: 현재 인메모리 `Map` 기반 rate limit → Upstash Redis 기반으로 교체.
- **왜**: Vercel 멀티 인스턴스에서 인스턴스 수만큼 한도 곱해짐. 상세: `audit/01-security.md §2`.
- **선행 조건**: 월 활성 학원 50개 이상 또는 의심 트래픽 관찰 시.
- **Effort**: S (human ~3시간 / CC ~30분)

### 14. Cloudflare Stream 영상 보안 정책 확인 (P2)
- **무엇**: 인강 영상 재생 URL(`https://iframe.videodelivery.net/{cfVideoId}`)이 공개 접근 가능한지, Signed URL 또는 Referrer 제한이 설정되어 있는지 확인·적용.
- **왜**: cfVideoId가 노출되면 수강 대상 외 누구나 영상 시청 가능. 상세: `audit/07-ingang.md §6`.
- **확인 방법**: Cloudflare 대시보드 → Stream → 해당 영상 → Security 탭에서 Signed URL 활성화 여부 확인.
- **옵션**: ① Signed URL (5분 만료 토큰, CF 기능) ② Referrer 제한 (`acams-jmi3.vercel.app`만 허용) ③ 공개 정책 유지 (의도된 설계라면 OK, SECURITY.md에 명시)
- **출발점**: CF 대시보드 확인 → Signed URL 선택 시 `/api/lectures/[id]` GET에서 시청 토큰 발급 로직 추가.
- **Effort**: S~M (CF 설정만이면 XS / 코드 연동 포함이면 M)

### 15. 모바일 PWA 직접 점검 (P2)
- **무엇**: 실제 모바일 디바이스에서 PWA 설치 후 빈 상태·반응형·UX 직접 확인.
- **왜**: 정적 코드 점검으로 검증 불가. 상세: `audit/05-ui-consistency.md §3~5`, `audit/06-mobile-pwa-payments.md §4~6`.
- **체크리스트**:
  - [ ] 신규 학원 시나리오(학생 0명, 반 0개, 청구 0건)로 로그인 후 전 페이지 순회 — "데이터 없음" 메시지 자연스러운지
  - [ ] 375×812(iPhone SE) 뷰포트에서 5탭 레이아웃 깨짐 없는지
  - [ ] 결제 플로우 실제 테스트 (토스 테스트 카드)
  - [ ] DevTools Memory 탭 — 5탭 왕복 시 메모리 누수 없는지
- **Effort**: XS (human ~1시간 직접 QA)

### 16. 코드 품질 도구 도입 (P3)
- **무엇**: ESLint + Prettier + npm audit + knip(미사용 코드) 도입.
- **왜**: 현재 1인 개발이라 후순위. 협업 인원 증가 또는 외주·인턴 투입 시 코드 스타일 가이드 필요. 상세: `audit/08-code-quality.md §7~9`.
- **순서**: ① `npm audit --production` (의존성 취약점 확인, 30분) → ② ESLint 설정 (1시간) → ③ knip 미사용 코드 검출 (30분)
- **출발점**: `npm install -D eslint eslint-config-next prettier` → `npx eslint --init` → `package.json`에 `lint` 스크립트 추가.
- **선행 조건**: 협업 인원 1명 이상 추가 또는 외부 코드리뷰 도입 시.
- **Effort**: S (human ~3시간 / CC ~30분)

## 청구 조정 시스템 (billing-adjustments, 2026-05-22)

### 17. 지난달 MonthlyAdjustment 복사 버튼 (**v1 포함** — 2026-05-22 /plan-eng-review에서 승격)
- **무엇**: 청구 생성 시 "지난달 항목 복사" 버튼 — 이전 달의 `MonthlyAdjustment`를 이번 달로 일괄 복사.
- **왜**: 교재비처럼 매달 반복되는 항목을 매달 새로 입력하는 부담 감소.
- **구현 방식**: `POST /api/finance/adjustments/monthly/copy-last-month` — `{ fromMonth, toMonth }` body, skip-if-identical 멱등성, `$transaction` 사용.
- **멱등 조건**: label·direction·amount·classId·studentId 5개 필드 모두 동일하면 skip.
- **선행 조건**: T5 (Layer 3 MonthlyAdjustment CRUD) 완료 후 T5 마지막 단계로 함께 구현.
- **Effort**: S (human ~4시간 / CC ~20분)

### 18. 형제/자매 관계 자동 감지 + 원장 알림 (Phase 2 P3)
- **무엇**: `StudentSibling` 모델(이미 존재) 활용하여 수강 등록 시 형제 관계 자동 감지 → 원장에게 "형제할인 적용 여부" 알림.
- **왜**: v1에서는 원장이 수동으로 형제할인을 설정. 자동 감지로 누락 방지.
- **선행 조건**: Layer 2 `EnrollmentRule` (T4) + 수강 등록 UI (T8) 운영 1개월 후.
- **출발점**: `ClassEnrollment` 생성 API에서 `StudentSibling` 관계 조회 → 형제 발견 시 `Notification` 생성.
- **Effort**: M (human ~1일 / CC ~30분)

## 마케팅 페이지 (/intro, 2026-06-02 /plan-eng-review 차별화 리포지셔닝 후속)

### 19. 창업자 노트 실명·약력·사진 (P3)
- **무엇**: `/intro` 창업자 노트 섹션의 익명("학원로그 드림")을 실명 + 1줄 약력(+선택적 사진)으로 교체.
- **왜**: '만든 사람'을 드러내면 미션 앵커 신뢰도↑. 동네학원 원장 대상 공감 강화.
- **현재 상태**: `src/app/intro/page.tsx`의 `.i-founder-quote`/`.i-founder-by` 익명 처리, CSS는 `.i-founder*` 완비.
- **출발점**: `.i-founder-by` 텍스트 교체 + 필요 시 `.i-founder-card`에 아바타 마크업/CSS 추가.
- **선행 조건**: 창업자 공개 의사 결정.
- **Effort**: XS (human ~30분 / CC ~10분)

### 20. 인강 수익 '예시 산식 → 실제 파일럿 사례' 교체 (P2)
- **무엇**: 인강 섹션 `.i-revenue-ex` 예시 산식(재원생 30명 중 10명 × 5만원 = +50만원 [예시])을 실제 파일럿 학원 후기·수치로 교체.
- **왜**: 추정 예시보다 실제 사례가 전환 설득력↑. 'AI 과장 금지' 정직성 가드와 동일 맥락 — '보장' 표현은 계속 회피.
- **현재 상태**: 면책 캡션("실제 수익을 보장하지 않습니다") 포함 예시 산식만 노출.
- **출발점**: 파일럿 학원 1곳 동의 확보 → `.i-revenue-ex` 카피·수치 교체, 필요 시 후기 카드 마크업 추가.
- **선행 조건**: 인강 수익 실데이터 보유 학원 1곳 + 공개 동의.
- **Effort**: S (human ~반나절 / CC ~20분)

### 21. 히어로 헤드라인 A/B 카피 실험 (P3)
- **무엇**: 히어로 `<h1>` "대형학원만 쓰던 무기를, 동네학원도" vs 대안 카피(예: "동네학원도, 데이터로 운영하는 시대") A/B 비교.
- **왜**: 헤드라인은 전환 최대 레버. 감이 아니라 데이터로 카피 결정.
- **현재 상태**: 단일 헤드라인 하드코딩(`src/app/intro/page.tsx`).
- **출발점**: 전환 분석(Vercel Analytics/PostHog 등) + 변형 분기 또는 `src/proxy.ts` 버킷팅.
- **선행 조건**: 분석·실험 인프라 도입.
- **Effort**: M (human ~2일 / CC ~2시간)
