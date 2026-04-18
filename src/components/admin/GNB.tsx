'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useEffect } from 'react';
import { LogOut } from 'lucide-react';
import clsx from 'clsx';

export default function GNB() {
  const pathname = usePathname();
  const { currentUser, hydrate, logout } = useAuthStore();
  const isIngang = pathname.startsWith('/ingang');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <header
      className="flex items-center justify-between px-5 shrink-0 z-30"
      style={{ height: 50, backgroundColor: '#1a2535' }}
    >
      {/* Logo + Tab Navigation */}
      <div className="flex items-center gap-6">
        <span className="text-[17px] font-bold text-white tracking-tight select-none">
          Aca<span style={{ color: '#4fc3a1' }}>MS</span>
        </span>

        <nav className="flex items-center gap-1">
          <Link
            href="/students"
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-colors',
              !isIngang
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white/80 hover:bg-white/5',
            )}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4fc3a1' }} />
            학원 관리
          </Link>

          <span
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium text-white/30 cursor-not-allowed select-none"
            title="추후 개발 예정"
          >
            <span className="w-2 h-2 rounded-full bg-[#a78bfa]/40" />
            인강
          </span>
        </nav>
      </div>

      {/* User Info + Logout */}
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-white/60">
          {currentUser?.academyName ?? '세계로학원'}
        </span>
        <span className="text-white/40 text-[11px]">·</span>
        <span className="text-[12.5px] text-white/80">
          {currentUser?.name ?? '원장'}
        </span>
        <button
          onClick={logout}
          className="flex items-center gap-1 text-[12px] text-white/50 hover:text-white/90 transition-colors cursor-pointer ml-1"
          title="로그아웃"
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
}
