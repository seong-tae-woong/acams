import { describe, it, expect } from 'vitest';
import { blocksToText, choiceLabel, answerDisplay, sanitizeForPdf } from './pdfContent';
import type { QuestionContent } from '@/lib/types/questionBank';

describe('sanitizeForPdf', () => {
  it('폰트 미포함 화살표를 ASCII로 정규화', () => {
    expect(sanitizeForPdf('discussed about → discussed')).toBe('discussed about -> discussed');
    expect(sanitizeForPdf('A ⇒ B, C ← D')).toBe('A => B, C <- D');
  });

  it('OX 표기·부등호 정규화', () => {
    expect(sanitizeForPdf('✓ 맞음 ✗ 틀림')).toBe('O 맞음 X 틀림');
    expect(sanitizeForPdf('a ≠ b, x ≤ y')).toBe('a != b, x <= y');
  });

  it('이모지 OX(✅❌)도 정규화(생성 모델이 해설에 자주 씀)', () => {
    expect(sanitizeForPdf('✅ 정답 ❌ 오답')).toBe('O 정답 X 오답');
  });

  it('원문자 ①②③ → (1)(2)(3)', () => {
    expect(sanitizeForPdf('①②③')).toBe('(1)(2)(3)');
  });

  it('subset에 포함된 문자(· — 곡선따옴표 …)는 보존', () => {
    expect(sanitizeForPdf('중3 · 난이도 … “인용” — 끝')).toBe('중3 · 난이도 … “인용” — 끝');
  });

  it('매핑 없는 미포함 기호(기호 구간)는 제거(tofu 방지)', () => {
    expect(sanitizeForPdf('∴ 그러므로 참')).toBe(' 그러므로 참'); // ∴(2234) 수학구간 제거
    expect(sanitizeForPdf('별표★표시')).toBe('별표표시'); // ★(2605) 기호구간 제거
  });

  it('※는 * 로 매핑(General Punctuation 미포함)', () => {
    expect(sanitizeForPdf('※ 주의')).toBe('* 주의');
  });
});

describe('blocksToText', () => {
  it('text 블록을 이어붙인다', () => {
    expect(blocksToText([{ type: 'text', text: '다음 중 자동사는?' }])).toBe('다음 중 자동사는?');
  });

  it('math는 latex 원문, figure는 [그림] 자리표시자', () => {
    expect(blocksToText([{ type: 'math', latex: 'x^2' }])).toBe('x^2');
    expect(blocksToText([{ type: 'figure', assetId: 'a1' }])).toBe('[그림]');
  });

  it('배열이 아니면 빈 문자열(방어)', () => {
    // @ts-expect-error 런타임 방어 검증
    expect(blocksToText(null)).toBe('');
  });
});

describe('choiceLabel', () => {
  it('0-based index → (1)부터 시작하는 ASCII 라벨', () => {
    expect(choiceLabel(0)).toBe('(1)');
    expect(choiceLabel(3)).toBe('(4)');
  });
});

describe('answerDisplay', () => {
  const content: QuestionContent = {
    stem: [{ type: 'text', text: '지문' }],
    choices: [
      [{ type: 'text', text: 'run' }],
      [{ type: 'text', text: 'arrive' }],
    ],
  };

  it('객관식 + content → (번호) 보기텍스트', () => {
    expect(answerDisplay({ kind: 'choice', index: 1 }, content)).toBe('(2) arrive');
  });

  it('객관식 + content 없음 → 번호만', () => {
    expect(answerDisplay({ kind: 'choice', index: 1 })).toBe('(2)');
  });

  it('주관식 → 값 그대로', () => {
    expect(answerDisplay({ kind: 'text', value: '정답입니다' })).toBe('정답입니다');
  });
});
