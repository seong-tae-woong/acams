/**
 * billStatus.ts — Prisma BillStatus → 한국어 UI 레이블 공유 유틸
 *
 * API 라우트마다 중복 정의되던 BILL_STATUS_TO_UI를 단일 소스로 통합.
 * 새 status 추가 시 이 파일만 수정하면 됩니다.
 */
import { BillStatus } from '@/generated/prisma/client';

export const BILL_STATUS_KO: Record<BillStatus, string> = {
  [BillStatus.DRAFT]:     '초안',
  [BillStatus.PAID]:      '완납',
  [BillStatus.UNPAID]:    '미납',
  [BillStatus.PARTIAL]:   '부분납',
  [BillStatus.CANCELLED]: '취소됨',
};
