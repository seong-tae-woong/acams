'use client';
import { useAuthStore } from '@/lib/stores/authStore';
import { useEffect, useState } from 'react';
import { LogOut, KeyRound, X } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

export default function SuperAdminHeader() {
  const { currentUser, hydrate, logout } = useAuthStore();
  const [pwOpen, setPwOpen] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast('새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? '비밀번호 변경에 실패했습니다.', 'error');
        return;
      }
      toast('비밀번호가 변경되었습니다.', 'success');
      setPwOpen(false);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full text-[13px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] focus:ring-1 focus:ring-[#4fc3a1]/20 transition-colors';

  return (
    <>
      <header className="bg-[#1a2535] h-[50px] flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#4fc3a1] text-[16px] font-bold">AcaMS</span>
          <span className="text-[#6b7280] text-[12px] ml-2">슈퍼 관리자</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#9ca3af] text-[12.5px]">{currentUser?.name}</span>
          <button
            onClick={() => setPwOpen(true)}
            className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] hover:text-white transition-colors cursor-pointer"
            title="비밀번호 변경"
          >
            <KeyRound size={14} />
            비밀번호 변경
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] hover:text-white transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </header>

      {/* 비밀번호 변경 모달 */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[14px] shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-[#111827]">비밀번호 변경</h2>
              <button
                onClick={() => { setPwOpen(false); setForm({ currentPassword: '', newPassword: '', confirm: '' }); }}
                className="text-[#9ca3af] hover:text-[#374151] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] text-[#6b7280] mb-1.5">현재 비밀번호</label>
                <input
                  type="password"
                  className={inputCls}
                  value={form.currentPassword}
                  onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  placeholder="현재 비밀번호 입력"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#6b7280] mb-1.5">새 비밀번호 (8자 이상)</label>
                <input
                  type="password"
                  className={inputCls}
                  value={form.newPassword}
                  onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  placeholder="새 비밀번호 입력"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] text-[#6b7280] mb-1.5">새 비밀번호 확인</label>
                <input
                  type="password"
                  className={inputCls}
                  value={form.confirm}
                  onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                  placeholder="새 비밀번호 재입력"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-colors"
                style={{ backgroundColor: '#1a2535' }}
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
