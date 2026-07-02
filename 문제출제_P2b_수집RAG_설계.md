# 문제출제 P2b — 수집(Ingestion) · RAG 그라운딩 설계

> 작성: 2026-07-02 · 상태: **설계만(미구현)**. 새 세션이 이 문서로 착수.
> **선행: 먼저 [`문제출제_설계.md`](./문제출제_설계.md)의 "🧭 새 세션 이어받기 가이드"를 읽을 것** (코드맵·실행법·절대제약). 이 문서는 그 위에 P2b를 얹는다.

## 목적 (왜 이게 본체인가)

지금(P1~P2)은 **AI가 스펙+코멘트로 새 문제를 순수 생성**만 한다. P2b는 **학원의 기출/교재를 업로드해 문제은행을 채우고, 생성 시 그걸 근거(RAG)로 참고해 "그 학원 스타일"로 출제**한다. → AI가 아무거나가 아니라 *우리 학원 기출처럼* 뽑아주는 것. 문제은행 기능의 진짜 본체이자 차별화 핵심.

## 현재 상태 — 무엇이 있고 없나

- **있음(플라이휠)**: 생성→승인 문항이 `BankQuestion`에 자동 적재됨(`promote.ts`). 은행 테이블·enum은 이미 P2b용으로 슈퍼셋 설계돼 있음:
  - `enum QuestionSource { AI_GENERATED, VARIANT, INGESTED }` — **INGESTED**(업로드 파싱) 값 이미 존재
  - `enum BankReviewStatus { DRAFT, PENDING, APPROVED, ARCHIVED }` — 은행 문항 검수 상태
  - `model BankQuestionAsset { blobUrl, bbox, kind }` — 도형 자산(Vercel Blob **private**)
  - `BankQuestion.content`는 슈퍼셋 블록(text|math|figure)
- **없음(P2b가 채울 것)**:
  1. **업로드→구조화→적재** 경로 (수집)
  2. **임베딩**(`BankQuestion.embedding` 컬럼 + pgvector) — 의미검색용
  3. **RAG 그라운딩** — 생성 시 은행을 예시로 주입
  4. **문제은행 조회/관리 UI**
  5. `SourceDocument` 모델(업로드 원본·파싱상태)

---

## 4단계 파이프라인

```
① 수집(Ingestion)         ② 은행 저장+임베딩       ③ RAG 그라운딩          ④ 검수·출력
업로드(PDF·사진)          BankQuestion 적재         생성 시 은행에서          기존 재사용
 → 비전 LLM 구조화         + embedding(pgvector)     관련 문항 검색→예시 주입   (검수·PDF·승인)
 → 자동검수 → 강사검수
```

①②는 P2b 신규, ③은 `generate.ts` 확장, ④는 P1 그대로 재사용.

---

## ⚠️ 먼저 정할 결정 3개 (착수 전 office-hours/eng-review로 확정)

### 결정 1 — 임베딩 벤더 (Anthropic 미제공)
의미검색용 벡터. **한국어+영어 성능**이 관건. 후보:
| 벤더 | 모델 예 | 비고 |
|---|---|---|
| **Voyage AI** | `voyage-3` / `voyage-multilingual` | Anthropic 추천 파트너, 다국어 강함 |
| OpenAI | `text-embedding-3-small/large` | 저렴·범용, 한국어 무난 |
| Cohere | `embed-multilingual-v3` | 다국어 특화 |
- 결정 시 확인: 한국어 문항 유사도 품질(간단 eval), 차원 수(pgvector 인덱스), 단가, rate limit.
- **추천 기본값**: Voyage(다국어 품질) 또는 OpenAI(비용·간편). 소규모 시작이면 OpenAI로 빠르게.

### 결정 2 — 비동기 잡 인프라 (업로드 파싱이 60초+)
한 번 업로드에 문항 여러 개 → 비전 호출 여러 번 → **Hobby 60초·Pro 300초로도 부족할 수 있음.** 옵션:
| 방식 | 내용 | 적합 |
|---|---|---|
| **A. 페이지/문항별 순차(클라 오케스트레이션)** | 모의고사 섹션처럼 클라가 페이지마다 짧은 호출 순차 | **P2b-1 시작에 최적**(신규 인프라 0) |
| B. 큐 테이블 + Vercel Cron 폴링 | `SourceDocument.status` 큐, Cron이 처리 | 중간 규모, 인프라 최소 |
| C. 외부 큐/잡 (Inngest·QStash·Trigger.dev) | 진짜 백그라운드 워커 | 대량·안정, 벤더 추가 |
- **추천**: **A로 시작**(모의고사 섹션 순차 패턴 재사용) → 대량 필요해지면 B/C. Batch API(−50%)는 대량 재처리에.

### 결정 3 — 검수 흐름(업로드 문항)
업로드 파싱은 정답키·구조 오류 위험이 생성보다 큼. 수집 게이트 = **글자깨짐·구조결함**(기존 `review.ts` 재사용/확장) → 강사 검수 필수. 자동+사람 2단은 P1과 동일 철학. CLOVA OCR 교차검증은 선택(한국어 충실도).

---

## 데이터 모델 (신규/변경)

```prisma
// 신규 — 업로드 원본
model SourceDocument {
  id         String   @id @default(cuid())
  academyId  String
  academy    Academy  @relation(fields: [academyId], references: [id], onDelete: Cascade)
  blobUrl    String   // Vercel Blob(private) — 프록시로만 서빙
  filename   String
  pageCount  Int      @default(0)
  status     String   @default("UPLOADED") // UPLOADED|PARSING|PARSED|REVIEW|DONE|FAILED
  parsedCount Int     @default(0)
  createdBy  String
  createdAt  DateTime @default(now())
  questions  BankQuestion[]  // 이 원본에서 파싱된 문항
  @@index([academyId, status])
  @@map("source_documents")
}

// 변경 — BankQuestion
//  + embedding  Unsupported("vector(1536)")?  // pgvector. 차원은 벤더 결정에 맞춤
//  + sourceDocumentId String?  (SourceDocument 링크)
//  source = INGESTED, reviewStatus = PENDING/APPROVED 흐름 사용
```
- **pgvector**: Neon에 `CREATE EXTENSION vector;` (또는 Neon 콘솔). Prisma는 vector 타입을 `Unsupported(...)`로 선언 + raw SQL로 검색(`<=>` 코사인). 인덱스는 hnsw 권장.
- 임베딩 대상: `content.stem`(+선택 choices) 평문. 저장 시 `blocksToText` 유사 로직으로 평문화 후 임베딩.
- **BankQuestionAsset**(이미 존재)로 도형 자산 — 단, P2b 텍스트형은 비워두고 P3에서 채움.

---

## 서비스 · API · UI

### 서비스 (신규 `src/lib/ai/`)
- **`ingest.ts`** — 이미지/PDF 페이지 → Claude **비전** tool-use로 문항 구조화(JSON). 일반 Sonnet 4.6, 난페이지 Opus 4.8. 출력 스키마는 `schema.ts`의 생성 스키마와 유사(stem·choices·answer·type·difficulty). OCR 아님 — 비전 LLM이 구조(지문/보기/정답)까지 이해.
- **`embed.ts`** — 결정1 벤더 호출. `embed(texts: string[]) → number[][]`. 캐싱·배치.
- 검수는 **기존 `review.ts` 재사용**(글자깨짐·정답 재풀이). stage='INGESTION' 플래그로 구분(이미 `QualityFlag.stage` 있음).

### API (신규 `src/app/api/question-bank/`)
- `POST /ingest` — 파일 업로드 접수: Blob 저장(private) + `SourceDocument` 생성. 반환 sourceId + pageCount.
- `POST /ingest/[id]/page` — (방식 A) 페이지 1장 파싱: 비전 구조화 → 검수 → 임시 저장(강사 검수 대기). 클라가 페이지 순차 호출.
- `GET /bank` — 문제은행 목록/필터(academyId·subject·유형·난이도·source). 
- `PATCH /bank/[id]` — 강사가 파싱 문항 수정/승인(→ reviewStatus APPROVED + 임베딩 생성).
- `DELETE /bank/[id]` — 은행 문항 삭제.
- 모두 **academyId 스코프 필수**(은행 격리 — 한 학원 기출이 타 학원에 새면 절대 안 됨).

### UI (신규 `src/app/(admin)/questions/bank/` + `src/components/questionBank/`)
- **업로드 화면**: 파일 선택 → 진행상태(페이지별) → 파싱 문항 강사 검수/수정 그리드 → "은행에 적재".
- **문제은행 조회/관리**: 필터·검색, 문항 편집·삭제.
- **생성 폼 옵션**: "우리 문제은행 참고(RAG)" 토글 — 켜면 ③ 그라운딩 사용.

---

## ③ RAG 그라운딩 상세 (generate.ts 확장)

생성 시 은행을 예시로 주입해 학원 스타일 반영:
```
1. SQL 필터: BankQuestion where academyId·subject·gradeLevel·type·difficulty(±1)·reviewStatus=APPROVED  → 후보
2. 코멘트/스펙 있으면: 코멘트를 embed → 후보 중 pgvector 코사인 top-K (예: 3~5개)
   (코멘트 없으면 정형필드 후보에서 랜덤/최신 top-K)
3. K개 예시를 SYSTEM/USER 프롬프트에 few-shot으로 주입:
   "아래는 이 학원의 기출 예시다. 이 톤·난이도·형식을 참고하되 그대로 베끼지 말고 새로 만들어라: [예시들]"
4. 매칭 0개 → 지금처럼 순수 생성(그라운딩 없이)
```
- `generate.ts`의 `buildUserPrompt`에 예시 섹션 추가. 예시는 `BankQuestion.content`를 평문화.
- **주의**: 베끼기 방지(프롬프트 명시) + 저작권(학원 자체 기출만, 타 학원/외부 저작물 업로드 정책은 별도 고지).

---

## 단계 (P2b도 크니 3단계로)

- **P2b-1 — 수집 최소 루프(임베딩 없이)**: pgvector 제외. 업로드 → 비전 구조화(방식 A 순차) → 검수 → 강사 검수/수정 → `BankQuestion`(source=INGESTED) 적재 + 문제은행 조회 UI. *여기까지만 해도 "은행에 기출 쌓기"가 됨.*
- **P2b-2 — 임베딩 + RAG**: `embedding` 컬럼 + pgvector, `embed.ts`, 승인 시 임베딩 생성, ③ 그라운딩을 generate에 연결 + 생성 폼 토글. *여기서 "학원 스타일 출제"가 켜짐.*
- **P2b-3 — 규모·품질**: 대량 업로드(비동기 잡 B/C), Batch API, 문제은행 관리 고도화, 인제스천 정확도 eval.

---

## 절대 제약 · 함정

1. **academyId 격리(최우선)** — 은행·업로드·검색 전부 학원별. 한 학원 기출이 타 학원 생성에 새면 치명적. 모든 쿼리·RAG 검색에 academyId.
2. **Vercel Blob은 private 스토어** — `put(access:'public')` 실패. 업로드는 private + 프록시 라우트로 서빙(기존 `gallery-proxy` 패턴 참고).
3. **AI 호출은 Prisma 트랜잭션 밖**(P2028). 비전·임베딩 다 밖에서 → 결과만 짧은 txn 저장.
4. **비용** — 비전 인제스천이 가장 비쌈. Batch(−50%)+캐싱, 페이지 해상도 최적화. 학원별 쿼터 고려.
5. **한국어 충실도** — 비전 파싱 오류 가능. 자동검수 + 강사검수 2단 필수(정답키 특히).
6. **pgvector 차원 = 임베딩 벤더 차원**과 일치. 벤더 바꾸면 재임베딩.

---

## 테스트 / eval

- **인제스천 eval**: 골든 이미지(기출 스캔) → 기대 구조(JSON) 비교. 구조화 정확도·정답키 정확도 측정. `eval/` 에 추가(기존 `reviewEval.ts` 패턴).
- **RAG eval**: 쿼리(코멘트)→검색된 예시 관련성. 그라운딩 on/off 생성 품질 비교.
- **보안 테스트(IRON RULE)**: 업로드·은행·검색 academyId 격리, 권한 403 — `security.test.ts`에 추가.

## 착수 체크리스트 (새 세션용)

1. [ ] `문제출제_설계.md` 이어받기 가이드 읽기 (코드맵·제약)
2. [ ] 결정 3개 확정(임베딩 벤더 / 비동기 방식 / 검수 흐름) — office-hours 또는 eng-review
3. [ ] P2b-1 스키마: `SourceDocument` + `BankQuestion.sourceDocumentId` (임베딩은 P2b-2) → `prisma db push`
4. [ ] `ingest.ts`(비전) + `POST /ingest`, `/ingest/[id]/page`(순차) — Blob private 업로드
5. [ ] 검수(review 재사용) → 강사 검수 UI → 적재
6. [ ] 문제은행 조회 UI
7. [ ] (P2b-2) pgvector + `embed.ts` + RAG 그라운딩 generate 연결 + 폼 토글
8. [ ] eval·보안테스트

> 관련: 원본 office-hours 설계 `~/.gstack/projects/5.AcaMS/ast29-design-20260630-question-bank.md`, 메인 설계 `문제출제_설계.md`(후속 백로그 2번이 이 문서의 요약).
