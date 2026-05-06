'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '비밀번호 변경에 실패했습니다.');
        return;
      }

      router.replace(data.redirectTo ?? '/students');
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[16px] bg-[#1a2535] mb-4">
            <span className="text-[#4fc3a1] text-[22px] font-bold">A</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#111827]">AcaMS</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">학원 관리 시스템</p>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-[14px] border border-[#e2e8f0] shadow-sm p-8">
          <h2 className="text-[16px] font-semibold text-[#111827] mb-1">비밀번호 변경</h2>
          <p className="text-[12.5px] text-[#6b7280] mb-6">
            보안을 위해 새 비밀번호를 설정해주세요.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[12.5px] text-[#374151] font-medium mb-1.5">
                현재 비밀번호 (임시 비밀번호)
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="SMS로 받은 임시 비밀번호"
                required
                autoComplete="current-password"
                className="w-full text-[13px] border border-[#e2e8f0] rounded-[10px] px-4 py-2.5 focus:outline-none focus:border-[#4fc3a1] focus:ring-2 focus:ring-[#4fc3a1]/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[12.5px] text-[#374151] font-medium mb-1.5">
                새 비밀번호
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="영문+숫자+특수문자 8자 이상"
                required
                autoComplete="new-password"
                className="w-full text-[13px] border border-[#e2e8f0] rounded-[10px] px-4 py-2.5 focus:outline-none focus:border-[#4fc3a1] focus:ring-2 focus:ring-[#4fc3a1]/20 transition-colors"
              />
              <p className="text-[11px] text-[#9ca3af] mt-1">
                영문 · 숫자 · 특수문자(!@#$% 등) 포함, 8자 이상
              </p>
            </div>

            <div>
              <label className="block text-[12.5px] text-[#374151] font-medium mb-1.5">
                새 비밀번호 확인
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호를 다시 입력하세요"
                required
                autoComplete="new-password"
                className="w-full text-[13px] border border-[#e2e8f0] rounded-[10px] px-4 py-2.5 focus:outline-none focus:border-[#4fc3a1] focus:ring-2 focus:ring-[#4fc3a1]/20 transition-colors"
              />
            </div>

            {error && (
              <div className="text-[12.5px] text-[#991B1B] bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-[#1a2535] text-white text-[13px] font-semibold py-3 rounded-[10px] mt-2 hover:bg-[#243047] active:bg-[#111827] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {pending ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[#9ca3af] mt-6">
          © 2026 AcaMS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
