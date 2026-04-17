import clsx from 'clsx';

const COLORS: Record<string, string> = {
  // 상태
  재원: 'bg-[#D1FAE5] text-[#065f46]',
  출석: 'bg-[#D1FAE5] text-[#065f46]',
  완납: 'bg-[#D1FAE5] text-[#065f46]',
  게시됨: 'bg-[#D1FAE5] text-[#065f46]',
  // 주의
  휴원: 'bg-[#FEF3C7] text-[#92400E]',
  지각: 'bg-[#FEF3C7] text-[#92400E]',
  부분납: 'bg-[#FEF3C7] text-[#92400E]',
  주의: 'bg-[#FEF3C7] text-[#92400E]',
  대기: 'bg-[#FEF3C7] text-[#92400E]',
  임시저장: 'bg-[#FEF3C7] text-[#92400E]',
  // 위험
  퇴원: 'bg-[#FEE2E2] text-[#991B1B]',
  결석: 'bg-[#FEE2E2] text-[#991B1B]',
  미납: 'bg-[#FEE2E2] text-[#991B1B]',
  위험: 'bg-[#FEE2E2] text-[#991B1B]',
  // 파랑
  조퇴: 'bg-[#DBEAFE] text-[#1d4ed8]',
  진행중: 'bg-[#DBEAFE] text-[#1d4ed8]',
  대면: 'bg-[#DBEAFE] text-[#1d4ed8]',
  온라인: 'bg-[#DBEAFE] text-[#1d4ed8]',
  전화: 'bg-[#DBEAFE] text-[#1d4ed8]',
};

interface BadgeProps {
  label: string;
  className?: string;
}

export default function Badge({ label, className }: BadgeProps) {
  const colorClass = COLORS[label] ?? 'bg-[#f1f5f9] text-[#374151]';
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-[20px] text-[11px] font-medium whitespace-nowrap',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
