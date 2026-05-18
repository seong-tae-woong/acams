'use client';
import { useState } from 'react';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { toast } from '@/lib/stores/toastStore';
import { Send } from 'lucide-react';
import { generateBillingContent, type BillingNotifTarget } from '../_shared';

interface BillingNotifModalProps {
  open: boolean;
  onClose: () => void;
  targets: BillingNotifTarget[];
  monthLabel: string;
  onSent: () => void;
}

export default function BillingNotifModal({ open, onClose, targets, monthLabel, onSent }: BillingNotifModalProps) {
  const { addNotification } = useCommunicationStore();
  const academyName = useAuthStore((s) => s.currentUser?.academyName) || '학원';

  const [billingNotifSending, setBillingNotifSending] = useState(false);

  const handleSendBillingNotif = async () => {
    setBillingNotifSending(true);
    try {
      for (const { studentId, studentName, bills } of targets) {
        await addNotification({
          type: '수납알림',
          title: `${monthLabel} 수강료 청구 안내`,
          content: generateBillingContent(academyName, studentName, bills, monthLabel),
          recipients: [studentId],
          sentBy: '',
          billIds: bills.map((b) => b.id),
        });
      }
      toast(`${targets.length}명에게 청구서를 발송했습니다.`, 'success');
      onSent();
      onClose();
    } finally {
      setBillingNotifSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="청구서 발송"
      size="md"
      footer={
        <>
          <Button variant="default" size="md" onClick={onClose}>취소</Button>
          <Button variant="dark" size="md" onClick={handleSendBillingNotif} disabled={billingNotifSending}>
            <Send size={13} /> {billingNotifSending ? '발송 중...' : `${targets.length}명에게 발송`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-3.5 bg-[#E1F5EE] border border-[#a7f3d0] rounded-[8px] text-[12.5px] text-[#065f46]">
          선택된 <strong>{targets.length}명</strong>에게 반별 청구액이 담긴 수납 알림을 각각 발송합니다.
          여러 반을 수강 중인 학생은 1개의 알림에 반별 금액과 총 합계가 포함됩니다.
        </div>

        <div>
          <div className="text-[11.5px] font-semibold text-[#374151] mb-2">발송 대상 ({targets.length}명)</div>
          <div className="border border-[#e2e8f0] rounded-[8px] overflow-hidden max-h-52 overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#f4f6f8]">
                  <th className="text-left px-3 py-2 text-[#6b7280] font-medium">학생</th>
                  <th className="text-left px-3 py-2 text-[#6b7280] font-medium">수강 반</th>
                  <th className="text-right px-3 py-2 text-[#6b7280] font-medium">청구 총액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {targets.map((t) => (
                  <tr key={t.studentId}>
                    <td className="px-3 py-2 text-[#111827] font-medium">{t.studentName}</td>
                    <td className="px-3 py-2 text-[#6b7280]">{t.bills.map(b => b.className).join(', ')}</td>
                    <td className="px-3 py-2 text-right text-[#0D9E7A] font-semibold">{t.total.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="text-[11.5px] font-semibold text-[#374151] mb-2">알림 내용 미리보기 (첫 번째 학생 기준)</div>
          <div className="p-3.5 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#374151] leading-relaxed whitespace-pre-line border border-[#e2e8f0]">
            {targets.length > 0
              ? generateBillingContent(academyName, targets[0].studentName, targets[0].bills, monthLabel)
              : ''}
          </div>
          <div className="mt-2 flex">
            <div className="px-4 py-2 rounded-[8px] text-[12px] font-semibold text-white cursor-default" style={{ backgroundColor: '#4fc3a1' }}>
              결제하기 (앱에서 활성화)
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
