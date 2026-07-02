// 역할별 Claude 모델 (eng-review D2 / 설계 rev3 모델 매트릭스)
// 모델 ID는 /claude-api 기준. 변경 시 이 파일 한 곳만 수정.

export const AI_MODELS = {
  /** 일반 문항 생성 */
  generation: 'claude-sonnet-4-6',
  /** 킬러·최고난도 생성 */
  generationKiller: 'claude-opus-4-8',
  /** 전수 자동 검수(경량 트리아지) */
  review: 'claude-haiku-4-5',
  /** 심층 판정(플래그·수학 재풀이 에스컬레이션) — P2 */
  reviewDeep: 'claude-sonnet-4-6',
} as const;

/** 킬러 여부에 따라 생성 모델 선택 */
export function pickGenerationModel(isKiller: boolean): string {
  return isKiller ? AI_MODELS.generationKiller : AI_MODELS.generation;
}
