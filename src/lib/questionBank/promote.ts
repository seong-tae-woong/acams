// 승인 시 TestDraftItem → BankQuestion 승격 매핑(플라이휠).
import { Prisma } from '@/generated/prisma/client';

/** BankQuestion 승격에 필요한 초안 문항 필드(TestDraftItem 서브셋) */
export interface PromotableItem {
  content: Prisma.JsonValue;
  answer: Prisma.JsonValue;
  explanation: Prisma.JsonValue | null;
  type: string | null;
  difficulty: number | null;
  isKiller: boolean;
  conceptTags: string[];
}

/**
 * 승인된 문항 → BankQuestion 생성 데이터.
 * subject/gradeLevel은 초안 스펙(문항엔 없음), 나머지는 문항 스냅샷.
 */
export function bankQuestionCreateData(
  item: PromotableItem,
  subject: string,
  gradeLevel: string,
  academyId: string,
  userId: string,
): Prisma.BankQuestionCreateManyInput {
  return {
    academyId,
    subject,
    gradeLevel,
    type: item.type ?? '',
    difficulty: item.difficulty ?? 3,
    isKiller: item.isKiller,
    conceptTags: item.conceptTags,
    content: item.content as Prisma.InputJsonValue,
    answer: item.answer as Prisma.InputJsonValue,
    ...(item.explanation != null
      ? { explanation: item.explanation as Prisma.InputJsonValue }
      : {}),
    source: 'AI_GENERATED',
    reviewStatus: 'APPROVED',
    createdBy: userId,
  };
}
