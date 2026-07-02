// 생성 문항 + 검수 플래그를 초안에 저장(createMany로 왕복 최소화 — Neon P2028 회피).
// T6(최초 생성)·feedback(재생성) 공용 DRY 헬퍼.
import { Prisma } from '@/generated/prisma/client';
import type { GeneratedQuestion, ReviewFlag } from '@/lib/ai/schema';
import { toQuestionContent, toQuestionAnswer } from './content';

type Tx = Prisma.TransactionClient;

/**
 * 문항 + 검수 플래그를 초안에 저장한다(트랜잭션 내).
 * @param flagsByOrder 문항 order(0-based) → 해당 문항의 검수 플래그
 */
export async function persistItems(
  tx: Tx,
  draftId: string,
  questions: GeneratedQuestion[],
  flagsByOrder: Map<number, ReviewFlag[]>,
  reviewModel: string | null,
): Promise<void> {
  if (questions.length === 0) return;

  await tx.testDraftItem.createMany({
    data: questions.map((q, i) => ({
      testDraftId: draftId,
      order: i,
      content: toQuestionContent(q) as unknown as Prisma.InputJsonValue,
      answer: toQuestionAnswer(q) as unknown as Prisma.InputJsonValue,
      explanation: q.explanation,
      type: q.type,
      difficulty: q.difficulty,
      isKiller: q.isKiller,
      conceptTags: q.conceptTags,
    })),
  });

  // 플래그를 문항 id에 연결하려면 방금 만든 item의 id가 필요 → order로 조회
  const items = await tx.testDraftItem.findMany({
    where: { testDraftId: draftId },
    orderBy: { order: 'asc' },
    select: { id: true, order: true },
  });

  const flagData = items.flatMap((item) =>
    (flagsByOrder.get(item.order) ?? []).map((f) => ({
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
