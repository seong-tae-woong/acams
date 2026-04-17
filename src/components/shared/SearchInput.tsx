'use client';
import { Search } from 'lucide-react';
import clsx from 'clsx';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput({ value, onChange, placeholder = '검색...', className }: SearchInputProps) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={13} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-[#e2e8f0] rounded-[8px] bg-white text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#4fc3a1] focus:ring-1 focus:ring-[#4fc3a1]"
      />
    </div>
  );
}
