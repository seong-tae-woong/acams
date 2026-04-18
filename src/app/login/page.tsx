'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '로그인에 실패했습니다.');
        return;
      }

      const role: string = data.user.role;
      if (role === 'super_admin') {
        router.push('/super-admin');
      } else if (role === 'parent' || role === 'student') {
        router.push('/mobile');
      } else {
        router.push('/students');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

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

        {/* 로그인 카드 */}
        <div className="bg-white rounded-[14px] border border-[#e2e8f0] shadow-sm p-8">
          <h2 className="text-[16px] font-semibold text-[#111827] mb-6">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12.5px] text-[#374151] font-medium mb-1.5">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                required
                autoComplete="email"
                className="w-full text-[13px] border border-[#e2e8f0] rounded-[10px] px-4 py-2.5 focus:outline-none focus:border-[#4fc3a1] focus:ring-2 focus:ring-[#4fc3a1]/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[12.5px] text-[#374151] font-medium mb-1.5">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
                autoComplete="current-password"
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
              disabled={loading}
              className="w-full bg-[#1a2535] text-white text-[13px] font-semibold py-3 rounded-[10px] mt-2 hover:bg-[#243047] active:bg-[#111827] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? '로그인 중...' : '로그인'}
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
