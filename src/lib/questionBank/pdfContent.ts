// PDF 출력용 표시 헬퍼 — 저장된 content/answer(Json) → 평문.
// ⚠️ noto-sans-kr korean subset은 원문자(①②③)·화살표 등 상당수 기호를 미포함 →
//    ASCII 안전 라벨((1) (2))만 쓰고, 본문은 sanitizeForPdf로 미포함 기호를 정규화/제거(tofu 방지).
import type { QuestionBlock, QuestionContent, QuestionAnswer } from '@/lib/types/questionBank';

// 폰트 미포함 기호 → ASCII 대체. (× … — – " ' • ± 는 subset에 포함돼 매핑하지 않음)
const SYMBOL_MAP: Record<string, string> = {
  '→': '->', '⟶': '->', '➔': '->', '➜': '->', '↦': '->',
  '⇒': '=>', '⇨': '=>', '⟹': '=>',
  '←': '<-', '⟵': '<-', '↔': '<->', '⟷': '<->',
  '✓': 'O', '✔': 'O', '☑': 'O', '○': 'O', '◯': 'O', '✅': 'O', '⭕': 'O',
  '✕': 'X', '✗': 'X', '✘': 'X', '❌': 'X', '✖': 'X', '❎': 'X', '☒': 'X',
  '≠': '!=', '≤': '<=', '≥': '>=',
  '⋯': '...', '―': '-', '‣': '-', '●': '-', '◦': '-', '▪': '-', '·': '·',
  // General Punctuation 중 subset 미포함(‥ 범위 밖이라 별도 매핑)
  '※': '*', '‹': '<', '›': '>', '′': "'", '″': '"',
};
// 원문자 ①..⑳ → (1)..(20)
for (let i = 0; i < 20; i++) SYMBOL_MAP[String.fromCodePoint(0x2460 + i)] = `(${i + 1})`;

// 한글·일반 문장부호가 아닌 기호 구간 — 매핑 후 남은 미포함 문자는 제거(tofu 방지)
function inSymbolStripRange(cp: number): boolean {
  return (
    (cp >= 0x2190 && cp <= 0x21ff) || // 화살표
    (cp >= 0x2200 && cp <= 0x22ff) || // 수학연산자
    (cp >= 0x2460 && cp <= 0x24ff) || // 원문자(매핑 후 잔여)
    (cp >= 0x2500 && cp <= 0x25ff) || // 박스/기하도형
    (cp >= 0x2600 && cp <= 0x27bf) || // 기타기호/딩뱃
    (cp >= 0x2b00 && cp <= 0x2bff) ||
    cp >= 0x1f000 // 이모지
  );
}

/** 폰트 미포함 기호를 ASCII로 정규화하고 잔여 미지원 기호는 제거 */
export function sanitizeForPdf(s: string): string {
  if (!s) return s;
  let out = '';
  for (const ch of s) {
    const mapped = SYMBOL_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const cp = ch.codePointAt(0);
    if (cp !== undefined && inSymbolStripRange(cp)) continue;
    out += ch;
  }
  // fi·fl·ff ligature 차단(ZWNJ) — korean subset의 fi 리거처 글리프가 i를 안 그려서
  // "finish"→"fnish"로 렌더되는 문제. f 뒤 f/i/l 사이에 zero-width non-joiner 삽입.
  return out.replace(/f(?=[fil])/g, 'f‌');
}

/** 블록 배열 → 표시용 평문. P1은 text만, math·figure는 자리표시자(렌더 P2·P3). */
export function blocksToText(blocks: QuestionBlock[]): string {
  if (!Array.isArray(blocks)) return '';
  const joined = blocks
    .map((b) => {
      if (b?.type === 'text') return b.text ?? '';
      if (b?.type === 'math') return b.latex ?? ''; // P2: KaTeX→이미지, 지금은 원문
      if (b?.type === 'figure') return '[그림]'; // P3
      return '';
    })
    .join(' ')
    .trim();
  return sanitizeForPdf(joined);
}

/** 보기 라벨 — (1) (2) … (원문자 미지원 폰트 대비 ASCII) */
export function choiceLabel(index: number): string {
  return `(${index + 1})`;
}

/** 정답 표시 — 객관식=(번호) 보기텍스트, 주관식=값 */
export function answerDisplay(answer: QuestionAnswer, content?: QuestionContent): string {
  if (!answer) return '';
  if (answer.kind === 'text') return sanitizeForPdf(answer.value ?? '');
  const n = answer.index + 1;
  const blocks = content?.choices?.[answer.index];
  const text = blocks ? blocksToText(blocks) : ''; // blocksToText가 이미 sanitize
  return text ? `(${n}) ${text}` : `(${n})`;
}
