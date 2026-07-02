/**
 * 오프라인 검수 eval — 골든셋으로 자동검수(Haiku)의 정밀도(오탐)·재현율(catch)을 측정한다.
 * 실 AI 호출(비용 발생) → 테스트 스위트 밖. 실행: `npm run eval:review` (또는 `npx tsx eval/reviewEval.ts`)
 * ANTHROPIC_API_KEY는 .env에서 자동 로드. review 체인은 상대경로 import(별칭 불필요).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { reviewGeneratedQuestions } from '../src/lib/ai/review';
import type { GeneratedQuestion } from '../src/lib/ai/schema';

// .env에서 키 로드(스크립트라 수동)
(function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return;
  try {
    const env = readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    const m = env.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, '');
  } catch {
    /* .env 없으면 환경변수 사용 */
  }
})();

function q(o: Partial<GeneratedQuestion>): GeneratedQuestion {
  return {
    stem: '',
    choices: [],
    answerIndex: null,
    answerText: null,
    explanation: '',
    type: '',
    difficulty: 3,
    isKiller: false,
    conceptTags: [],
    ...o,
  };
}

// 정상 문항 — 검수가 조용해야 함(오탐 0 기대 → precision)
const GOOD: GeneratedQuestion[] = [
  q({
    stem: '다음 중 어법상 옳은 것은?',
    choices: ['We discussed about it.', 'We discussed it.', 'We discussed of it.', 'We discussed on it.'],
    answerIndex: 1,
    explanation: 'discuss는 타동사로 전치사 없이 목적어를 취한다.',
  }),
  q({
    stem: "'generous'의 뜻으로 알맞은 것은?",
    choices: ['너그러운', '부지런한', '고대의', '풍부한'],
    answerIndex: 0,
    explanation: 'generous = 너그러운.',
  }),
  q({
    stem: '빈칸에 알맞은 형태: She ___ (arrive) at the station an hour ago.',
    choices: [],
    answerIndex: null,
    answerText: 'arrived',
    explanation: 'an hour ago → 과거시제.',
  }),
  q({
    stem: 'What is the past tense of "run"?',
    choices: ['runned', 'ran', 'run', 'running'],
    answerIndex: 1,
    explanation: 'run - ran - run.',
  }),
];

// 결함 문항 — 해당 플래그가 잡혀야 함(recall).
// expectSeverity: 정답 결함=ERROR(승인 차단돼야 함) / 표시 결함=WARNING(강사가 눈으로 봄, 비차단)
const BAD: { q: GeneratedQuestion; expect: string; expectSeverity: 'ERROR' | 'WARNING'; label: string }[] = [
  {
    label: '오답(정답 인덱스 틀림)',
    expect: 'ANSWER_MISMATCH',
    expectSeverity: 'ERROR',
    q: q({
      stem: 'The past tense of "go" is which of the following?',
      choices: ['goed', 'went', 'gone', 'going'],
      answerIndex: 0, // 'goed'는 틀림(정답은 'went'=1)
    }),
  },
  {
    label: '정답 없음',
    expect: 'NO_CORRECT_ANSWER',
    expectSeverity: 'ERROR',
    q: q({
      stem: '프랑스의 수도는 다음 중 무엇인가?',
      choices: ['런던', '베를린', '마드리드', '로마'], // 파리 없음
      answerIndex: 0,
    }),
  },
  {
    label: '복수 정답',
    expect: 'MULTIPLE_CORRECT',
    expectSeverity: 'ERROR',
    q: q({
      stem: '다음 중 과일인 것은?',
      choices: ['사과', '바나나', '당근', '책상'], // 사과·바나나 둘 다 과일
      answerIndex: 0,
    }),
  },
  {
    label: '글자 깨짐',
    expect: 'GARBLED_TEXT',
    expectSeverity: 'WARNING',
    q: q({
      stem: '다음 �� 밑줄 친 부분의 ��으로 옳은 것은?',
      choices: ['��pple', 'banana', 'cherry', 'date'],
      answerIndex: 1,
    }),
  },
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY 없음(.env 확인). eval 중단.');
    process.exit(1);
  }

  const all = [...GOOD, ...BAD.map((b) => b.q)];
  const goodN = GOOD.length;
  const res = await reviewGeneratedQuestions(all);

  if (res.refused) {
    console.error('❌ 검수가 거부됨(refused) — eval 불가.');
    process.exit(1);
  }

  const byIndex = new Map(res.reviews.map((r) => [r.index, r.flags]));

  // precision: 정상 문항이 ERROR 플래그를 받으면 오탐
  let falsePos = 0;
  const goodDetail: string[] = [];
  for (let i = 0; i < goodN; i++) {
    const flags = byIndex.get(i) ?? [];
    const err = flags.filter((f) => f.severity === 'ERROR');
    if (err.length > 0) falsePos++;
    goodDetail.push(
      `  [정상 ${i}] ${err.length === 0 ? 'OK ✓' : '오탐 ✗ ' + err.map((f) => f.code).join(',')}`,
    );
  }

  // 정답 결함(ERROR 기대)=승인 차단돼야 함 / 표시 결함(WARNING 기대)=플래그만 되면 됨(강사가 눈으로 봄)
  let codeExact = 0;
  let correctnessTotal = 0;
  let correctnessBlocked = 0;
  let displayTotal = 0;
  let displayFlagged = 0;
  const badDetail: string[] = [];
  BAD.forEach((b, j) => {
    const flags = byIndex.get(goodN + j) ?? [];
    const codes = flags.map((f) => f.code);
    const hasErr = flags.some((f) => f.severity === 'ERROR');
    if ((codes as string[]).includes(b.expect)) codeExact++;
    let ok: boolean;
    if (b.expectSeverity === 'ERROR') {
      correctnessTotal++;
      ok = hasErr;
      if (ok) correctnessBlocked++;
    } else {
      displayTotal++;
      ok = flags.length > 0;
      if (ok) displayFlagged++;
    }
    badDetail.push(
      `  [결함 ${j} · ${b.label} → ${b.expect}(${b.expectSeverity})] ${ok ? '탐지 ✓' : '놓침 ✗'} (실제: ${codes.join(',') || '없음'})`,
    );
  });

  const pct = (n: number, d: number) => ((n / d) * 100).toFixed(0);
  console.log('\n=== 검수(Haiku) 오프라인 eval ===');
  console.log(`정밀도(precision): 정상 ${goodN}문항 중 오탐 ${falsePos}건 → ${pct(goodN - falsePos, goodN)}% 깨끗`);
  console.log(`정답결함 차단(핵심): ${correctnessBlocked}/${correctnessTotal} ERROR로 차단 → ${pct(correctnessBlocked, correctnessTotal)}% (오답 인쇄 0)`);
  console.log(`표시결함 플래그:   ${displayFlagged}/${displayTotal} → ${pct(displayFlagged, displayTotal)}% (글자깨짐 등, 강사도 눈으로 봄)`);
  console.log(`코드 정확 일치:    ${codeExact}/${BAD.length} → ${pct(codeExact, BAD.length)}%`);
  if (res.usage) {
    console.log(`토큰: in ${res.usage.tokensIn} / out ${res.usage.tokensOut} · ${res.usage.model}`);
  }
  console.log('\n[정상 — 오탐 없어야]\n' + goodDetail.join('\n'));
  console.log('\n[결함 — 잡아야]\n' + badDetail.join('\n'));
  console.log('');
}

main().catch((e) => {
  console.error('eval 실패:', e);
  process.exit(1);
});
