'use client';
import clsx from 'clsx';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterTagsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function FilterTags({ options, value, onChange, className }: FilterTagsProps) {
  return (
    <div className={clsx('flex gap-1.5 flex-wrap', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'inline-flex items-center gap-1 px-3 py-1 rounded-[20px] text-[11.5px] font-medium transition-colors cursor-pointer',
            value === opt.value
              ? 'bg-[#1a2535] text-white'
              : 'bg-[#f1f5f9] text-[#6b7280] hover:bg-[#e2e8f0]',
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className={clsx('text-[10px]', value === opt.value ? 'text-[#4fc3a1]' : 'text-[#9ca3af]')}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
