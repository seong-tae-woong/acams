'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewAcademyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    academyName: '',
    slug: '',
    phone: '',
    directorName: '',
    directorEmail: '',
    directorPassword: '',
  });

  const fieldCls = 'w-full text-[13px] border border-[#e2e8f0] rounded-[10px] px-4 py-2.5 focus:outline-none focus:border-[#4fc3a1] focus:ring-2 focus:ring-[#4fc3a1]/20 transition-colors';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.academyName || !form.slug || !form.directorName || !form.directorEmail || !form.directorPassword) {
      toast('모든 필수 항목을 입력해주세요.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/academies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? '학원 등록에 실패했습니다.', 'error');
        return;
      }
      toast(`${form.academyName} 학원이 등록되었습니다.`, 'success');
      router.push('/super-admin');
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/super-admin" className="text-[#6b7280] hover:text-[#111827] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-[18px] font-bold text-[#111827]">학원 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 학원 정보 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-5 space-y-4">
          <h2 className="text-[13px] font-semibold text-[#374151]">학원 정보</h2>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">학원명 *</label>
            <input className={fieldCls} value={form.academyName} onChange={(e) => setForm((f) => ({ ...f, academyName: e.target.value }))} placeholder="예: 세계로학원" />
          </div>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">슬러그 * (영문 소문자·숫자·하이픈)</label>
            <input className={fieldCls} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="예: segyero" />
          </div>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">대표 전화</label>
            <input className={fieldCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="예: 02-1234-5678" />
          </div>
        </div>

        {/* 원장 계정 */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-5 space-y-4">
          <h2 className="text-[13px] font-semibold text-[#374151]">원장 계정 생성</h2>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">이름 *</label>
            <input className={fieldCls} value={form.directorName} onChange={(e) => setForm((f) => ({ ...f, directorName: e.target.value }))} placeholder="예: 홍길동" />
          </div>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">이메일 *</label>
            <input type="email" className={fieldCls} value={form.directorEmail} onChange={(e) => setForm((f) => ({ ...f, directorEmail: e.target.value }))} placeholder="예: director@academy.kr" />
          </div>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">비밀번호 * (8자 이상)</label>
            <input type="password" className={fieldCls} value={form.directorPassword} onChange={(e) => setForm((f) => ({ ...f, directorPassword: e.target.value }))} placeholder="초기 비밀번호" />
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/super-admin" className="flex-1">
            <Button variant="default" size="md" className="w-full">취소</Button>
          </Link>
          <Button variant="dark" size="md" className="flex-1" type="submit">
            {loading ? '등록 중...' : '학원 등록'}
          </Button>
        </div>
      </form>
    </div>
  );
}
