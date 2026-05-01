'use client';
import { Loader2 } from 'lucide-react';

interface Props {
  loading: boolean;
  children: React.ReactNode;
}

export default function MobileContentLoader({ loading, children }: Props) {
  return (
    <div className="relative flex-1 min-h-[200px]">
      <div
        className={`transition-opacity duration-300 ${
          loading ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'
        }`}
      >
        {children}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-md">
            <Loader2 size={18} className="text-[#4fc3a1] animate-spin" />
            <span className="text-[13px] font-medium text-[#374151]">불러오는 중…</span>
          </div>
        </div>
      )}
    </div>
  );
}
