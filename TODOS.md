# TODOS

> 본 PR 범위 밖이지만 추적해두고 싶은 작업들. 인강 진도율·시험 게이트(2026-05-20 design doc)에서 파생된 7건이 첫 등록.

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
