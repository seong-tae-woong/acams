'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useEffect, useState } from 'react';
import { LogOut, KeyRound, X } from 'lucide-react';
import clsx from 'clsx';
import { toast } from '@/lib/stores/toastStore';
import Wordmark from '@/components/shared/Wordmark';

export default function GNB() {
  const pathname = usePathname();
  const { currentUser, hydrate, logout } = useAuthStore();
  const isIngang = pathname.startsWith('/ingang');

  // 비밀번호 변경 모달 (원장·강사 셀프 변경 → /api/auth/change-password, 역할무관)
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const closePwModal = () => {
    setPwOpen(false);
    setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
  };

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      toast('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? '비밀번호 변경에 실패했습니다.', 'error');
        return;
      }
      // 변경 성공: API가 새 쿠키를 재발급하므로 재로그인 불필요. redirectTo는 무시하고 현재 화면 유지.
      toast('비밀번호가 변경되었습니다.', 'success');
      closePwModal();
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const pwInputCls =
    'w-full text-[13px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] focus:ring-1 focus:ring-[#4fc3a1]/20 transition-colors';

  return (
    <>
      <header
        className="flex items-center justify-between px-5 shrink-0 z-30"
        style={{ height: 50, backgroundColor: '#1a2535' }}
      >
        {/* Logo + Tab Navigation */}
        <div className="flex items-center gap-6">
          <Wordmark size={22} className="select-none" />

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

            <Link
              href="/ingang/lectures"
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-colors',
                isIngang
                  ? 'bg-white/10 text-[#a78bfa]'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/5',
              )}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isIngang ? '#a78bfa' : 'rgba(167,139,250,0.4)' }}
              />
              인강
            </Link>
          </nav>
        </div>

        {/* User Info + Actions */}
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-white/60">
            {currentUser?.academyName ?? '세계로학원'}
          </span>
          <span className="text-white/40 text-[11px]">·</span>
          <span className="text-[12.5px] text-white/80">
            {currentUser?.name ?? '원장'}
          </span>
          <div className="flex items-center gap-2 ml-1">
            <button
              onClick={() => setPwOpen(true)}
              className="flex items-center gap-1 text-[12px] text-white/50 hover:text-white/90 transition-colors cursor-pointer"
              title="비밀번호 변경"
            >
              <KeyRound size={13} />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-[12px] text-white/50 hover:text-white/90 transition-colors cursor-pointer"
              title="로그아웃"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* 비밀번호 변경 모달 (원장·강사 셀프 변경) */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[14px] shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-[#111827]">비밀번호 변경</h2>
              <button
                onClick={closePwModal}
                className="text-[#9ca3af] hover:text-[#374151] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePwSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] text-[#6b7280] mb-1.5">현재 비밀번호</label>
                <input
                  type="password"
                  className={pwInputCls}
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  placeholder="현재 비밀번호 입력"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#6b7280] mb-1.5">새 비밀번호 (8자 이상)</label>
                <input
                  type="password"
                  className={pwInputCls}
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                  placeholder="영문+숫자+특수문자 8자 이상"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#6b7280] mb-1.5">새 비밀번호 확인</label>
                <input
                  type="password"
                  className={pwInputCls}
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  placeholder="새 비밀번호 재입력"
                  autoComplete="new-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full mt-2 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: '#1a2535' }}
              >
                {pwLoading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
