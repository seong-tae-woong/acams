'use client';
import { useAuthStore } from '@/lib/stores/authStore';
import { useEffect } from 'react';
import { LogOut, Building2 } from 'lucide-react';

export default function SuperAdminHeader() {
  const { currentUser, hydrate, logout } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <header className="bg-[#1a2535] h-[50px] flex items-center px-6 justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[#4fc3a1] text-[16px] font-bold">AcaMS</span>
        <span className="text-[#6b7280] text-[12px] ml-2">슈퍼 관리자</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[#9ca3af] text-[12.5px]">{currentUser?.name}</span>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] hover:text-white transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    </header>
  );
}
