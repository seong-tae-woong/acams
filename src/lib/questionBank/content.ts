// 생성된 문항(GeneratedQuestion) ↔ 저장 형태(QuestionContent/QuestionAnswer) 변환.
// T6(초안 저장)·T7(승인 시 BankQuestion 승격) 공용. P1은 text 블록만.
import type { GeneratedQuestion } from '@/lib/ai/schema';
import type { QuestionContent, QuestionAnswer } from '@/lib/types/questionBank';

/** 문항 → content(블록 모델). P1은 text 블록으로 래핑(슈퍼셋). */
export function toQuestionContent(q: GeneratedQuestion): QuestionContent {
  const content: QuestionContent = {
    stem: [{ type: 'text', text: q.stem }],
  };
  if (q.choices.length > 0) {
    content.choices = q.choices.map((c) => [{ type: 'text', text: c }]);
  }
  return content;
}

/** 문항 → answer(객관식=인덱스 / 주관식=텍스트) */
export function toQuestionAnswer(q: GeneratedQuestion): QuestionAnswer {
  if (q.choices.length > 0 && typeof q.answerIndex === 'number') {
    return { kind: 'choice', index: q.answerIndex };
  }
  return { kind: 'text', value: q.answerText ?? '' };
}
