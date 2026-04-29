'use client';
import clsx from 'clsx';

interface Tab {
  value: string;
  label: string;
  badge?: number; // 탭 우측에 표시할 숫자 배지 (0이면 숨김)
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={clsx('flex border-b border-[#e2e8f0]', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            'px-4 py-2.5 text-[12.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-1.5',
            value === tab.value
              ? 'border-[#4fc3a1] text-[#0D9E7A]'
              : 'border-transparent text-[#6b7280] hover:text-[#374151]',
          )}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="inline-flex items-center justify-center h-[16px] min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9.5px] font-bold leading-none">
              {tab.badge > 99 ? '99+' : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
