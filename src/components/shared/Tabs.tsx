'use client';
import clsx from 'clsx';

interface Tab {
  value: string;
  label: string;
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
            'px-4 py-2.5 text-[12.5px] font-medium border-b-2 -mb-px transition-colors cursor-pointer',
            value === tab.value
              ? 'border-[#4fc3a1] text-[#0D9E7A]'
              : 'border-transparent text-[#6b7280] hover:text-[#374151]',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
