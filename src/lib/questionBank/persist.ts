// 생성 문항 + 검수 플래그를 초안에 저장(createMany로 왕복 최소화 — Neon P2028 회피).
// T6(최초 생성)·feedback(재생성) 공용 DRY 헬퍼.
import { Prisma } from '@/generated/prisma/client';
import type { GeneratedQuestion, ReviewFlag } from '@/lib/ai/schema';
import { toQuestionContent, toQuestionAnswer } from './content';

type Tx = Prisma.TransactionClient;

/**
 * 문항 + 검수 플래그를 초안에 저장한다(트랜잭션 내).
 * @param flagsByOrder 이번 배치 문항 인덱스(0-based) → 검수 플래그
 * @param opts.section 모의고사 섹션 인덱스(기본 0=단일 시험지)
 * @param opts.orderOffset 앞 섹션 문항 수(전역 order 연속) — 기본 0
 */
export async function persistItems(
  tx: Tx,
  draftId: string,
  questions: GeneratedQuestion[],
  flagsByOrder: Map<number, ReviewFlag[]>,
  reviewModel: string | null,
  opts: { section?: number; orderOffset?: number } = {},
): Promise<void> {
  const { section = 0, orderOffset = 0 } = opts;
  if (questions.length === 0) return;

  await tx.testDraftItem.createMany({
    data: questions.map((q, i) => ({
      testDraftId: draftId,
      order: orderOffset + i,
      section,
      content: toQuestionContent(q) as unknown as Prisma.InputJsonValue,
      answer: toQuestionAnswer(q) as unknown as Prisma.InputJsonValue,
      explanation: q.explanation,
      type: q.type,
      difficulty: q.difficulty,
      isKiller: q.isKiller,
      conceptTags: q.conceptTags,
    })),
  });

  // 이번 배치 문항만 조회(멀티섹션 대비: 같은 section + order>=offset). flagsByOrder는 배치 0-based.
  const items = await tx.testDraftItem.findMany({
    where: { testDraftId: draftId, section, order: { gte: orderOffset } },
    orderBy: { order: 'asc' },
    select: { id: true, order: true },
  });

  const flagData = items.flatMap((item) =>
    (flagsByOrder.get(item.order - orderOffset) ?? []).map((f) => ({
      testDraftItemId: item.id,
      stage: 'GENERATION',
      severity: f.severity,
      code: f.code,
      message: f.message,
      model: reviewModel,
    })),
  );
  if (flagData.length > 0) {
    await tx.qualityFlag.createMany({ data: flagData });
  }
}
