'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { Sparkles } from 'lucide-react';
import type { Bill } from '@/lib/types/finance';
import { formatMonth } from '../_shared';

interface AdjustmentItem {
  id: string;
  label: string;
  direction: 'discount' | 'add';
  amountType?: 'fixed' | 'percent';
  amount: number;
  memo?: string;
  isAuto?: boolean;
  autoTag?: string | null;
  scope?: string;
}

interface DetailResponse {
  feeType: string;
  baseFee: number;
  baseAmount: number;
  perLessonInfo?: { scheduledCount: number; absentCount: number; makeupCount: number; chargeable: number };
  enrollmentRules: AdjustmentItem[];
  monthlyAdjustments: AdjustmentItem[];
  legacyAdjust?: { amount: number; memo: string; count: number } | null;
  finalAmount: number;
  paidAmount: number;
}

interface BillDetailModalProps {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
}

export default function BillDetailModal({ open, onClose, bill }: BillDetailModalProps) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bill) { setData(null); return; }
    setLoading(true);
    fetch(`/api/finance/bills/${bill.id}/details`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: DetailResponse | null) => setData(d))
      .finally(() => setLoading(false));
  }, [open, bill]);

  if (!bill) return null;

  return (
    <Modal open={open} onClose={onClose} title="청구 세부 내역" size="md">
      {loading || !data ? (
        <div className="py-10 text-center text-[#9ca3af] text-[13px]">불러오는 중…</div>
      ) : (
        <div className="space-y-4">
          {/* 헤더: 학생/반/월 */}
          <div className="bg-[#f9fafb] rounded-[8px] px-3 py-2.5">
            <div className="text-[13px] font-semibold text-[#111827]">
              {bill.studentName} · {bill.className}
            </div>
            <div className="text-[11.5px] text-[#6b7280] mt-0.5">{formatMonth(bill.month)} 청구</div>
          </div>

          {/* 세부 내역 표 */}
          <div className="border border-[#e2e8f0] rounded-[8px] overflow-hidden">
            {/* 기본 수강료 */}
            <div className="px-3 py-2 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-[#374151]">기본 수강료</span>
                {data.feeType === 'per-lesson' && data.perLessonInfo && (
                  <span className="text-[11px] text-[#6b7280]">
                    ({data.perLessonInfo.chargeable}회 × {data.baseFee.toLocaleString()}원)
                  </span>
                )}
              </div>
              <span className="text-[12.5px] font-medium text-[#111827]">
                {data.baseAmount.toLocaleString()}원
              </span>
            </div>

            {/* per-lesson 출결 보조 */}
            {data.feeType === 'per-lesson' && data.perLessonInfo && (
              <div className="px-3 py-1.5 bg-[#f9fafb] text-[10.5px] text-[#6b7280] border-t border-[#f1f5f9]">
                배정 {data.perLessonInfo.scheduledCount}회
                {data.perLessonInfo.absentCount > 0 && (
                  <span className="text-[#991B1B]"> · 결석 -{data.perLessonInfo.absentCount}회</span>
                )}
                {data.perLessonInfo.makeupCount > 0 && (
                  <span className="text-[#065f46]"> · 보강 +{data.perLessonInfo.makeupCount}회</span>
                )}
              </div>
            )}

            {/* Layer 2: 수강 등록 규칙 */}
            {data.enrollmentRules.map((r) => (
              <div key={r.id} className="px-3 py-2 flex items-center justify-between border-t border-[#f1f5f9] bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px]"
                    style={
                      r.direction === 'discount'
                        ? { background: '#FEE2E2', color: '#991B1B' }
                        : { background: '#D1FAE5', color: '#065f46' }
                    }
                  >
                    {r.direction === 'discount' ? '할인' : '추가'}
                  </span>
                  <span className="text-[12.5px] text-[#374151]">{r.label}</span>
                  {r.isAuto && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] text-[#5B4FBE] bg-[#EEEDFE] px-1.5 py-0.5 rounded-[4px]"
                      title="형제 관계 자동 적용"
                    >
                      <Sparkles size={9} /> 자동
                    </span>
                  )}
                </div>
                <span
                  className="text-[12.5px] font-medium"
                  style={{ color: r.direction === 'discount' ? '#991B1B' : '#065f46' }}
                >
                  {r.direction === 'discount' ? '-' : '+'}
                  {r.amountType === 'percent'
                    ? `${r.amount}%`
                    : `${r.amount.toLocaleString()}원`}
                </span>
              </div>
            ))}

            {/* Layer 3: 월별 조정 */}
            {data.monthlyAdjustments.map((a) => (
              <div key={a.id} className="px-3 py-2 flex items-center justify-between border-t border-[#f1f5f9] bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px]"
                    style={
                      a.direction === 'discount'
                        ? { background: '#FEE2E2', color: '#991B1B' }
                        : { background: '#D1FAE5', color: '#065f46' }
                    }
                  >
                    {a.direction === 'discount' ? '할인' : '추가'}
                  </span>
                  <span className="text-[12.5px] text-[#374151]">{a.label}</span>
                  <span className="text-[10px] text-[#6b7280] bg-[#F1F5F9] px-1.5 py-0.5 rounded-[4px]">월별</span>
                </div>
                <span
                  className="text-[12.5px] font-medium"
                  style={{ color: a.direction === 'discount' ? '#991B1B' : '#065f46' }}
                >
                  {a.direction === 'discount' ? '-' : '+'}
                  {a.amount.toLocaleString()}원
                </span>
              </div>
            ))}

            {/* 레거시 조정 (Bill.adjustAmount) */}
            {data.legacyAdjust && (
              <div className="px-3 py-2 flex items-center justify-between border-t border-[#f1f5f9] bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-[#FEE2E2] text-[#991B1B]">차감</span>
                  <span className="text-[12.5px] text-[#374151]">
                    레거시 조정{data.legacyAdjust.memo ? ` (${data.legacyAdjust.memo})` : ''}
                  </span>
                </div>
                <span className="text-[12.5px] font-medium text-[#991B1B]">
                  -{data.legacyAdjust.amount.toLocaleString()}원
                </span>
              </div>
            )}

            {/* 최종 청구액 */}
            <div className="px-3 py-2.5 flex items-center justify-between border-t-2 border-[#e2e8f0] bg-[#f9fafb]">
              <span className="text-[13px] font-semibold text-[#111827]">최종 청구액</span>
              <span className="text-[14px] font-bold text-[#111827]">
                {data.finalAmount.toLocaleString()}원
              </span>
            </div>

            {/* 납부 정보 */}
            {data.paidAmount > 0 && (
              <div className="px-3 py-1.5 flex items-center justify-between bg-[#f9fafb] border-t border-[#e2e8f0]">
                <span className="text-[11.5px] text-[#6b7280]">납부액</span>
                <span className="text-[11.5px] font-medium text-[#0D9E7A]">
                  {data.paidAmount.toLocaleString()}원
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-[#f1f5f9]">
            <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
