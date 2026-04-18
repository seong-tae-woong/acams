'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Plus, Users, CheckCircle, XCircle } from 'lucide-react';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';

interface Academy {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; students: number };
}

export default function SuperAdminPage() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/super-admin/academies')
      .then((r) => r.json())
      .then((data) => {
        setAcademies(data);
        setLoading(false);
      })
      .catch(() => {
        toast('학원 목록을 불러오지 못했습니다.', 'error');
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#111827]">학원 관리</h1>
          <p className="text-[12.5px] text-[#6b7280] mt-0.5">등록된 학원 목록 및 원장 계정을 관리합니다.</p>
        </div>
        <Link href="/super-admin/academies/new">
          <Button variant="dark" size="sm"><Plus size={13} /> 학원 등록</Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[13px] text-[#9ca3af]">불러오는 중...</div>
      ) : academies.length === 0 ? (
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-16 text-center">
          <Building2 size={40} className="text-[#d1d5db] mx-auto mb-3" />
          <p className="text-[13px] text-[#9ca3af]">등록된 학원이 없습니다.</p>
          <Link href="/super-admin/academies/new" className="inline-block mt-4">
            <Button variant="dark" size="sm"><Plus size={13} /> 첫 학원 등록</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {academies.map((academy) => (
            <Link
              key={academy.id}
              href={`/super-admin/academies/${academy.id}`}
              className="block bg-white rounded-[12px] border border-[#e2e8f0] p-5 flex items-center justify-between hover:border-[#4fc3a1] hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-[10px] bg-[#1a2535] flex items-center justify-center">
                  <Building2 size={18} className="text-[#4fc3a1]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#111827]">{academy.name}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
                      style={
                        academy.isActive
                          ? { backgroundColor: '#D1FAE5', color: '#065f46' }
                          : { backgroundColor: '#F3F4F6', color: '#6b7280' }
                      }
                    >
                      {academy.isActive ? '운영중' : '비활성'}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#6b7280] mt-0.5">
                    slug: {academy.slug}{academy.phone ? ` · ${academy.phone}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-[12.5px] text-[#6b7280]">
                <div className="text-center">
                  <div className="text-[16px] font-bold text-[#111827]">{academy._count.students}</div>
                  <div>학생</div>
                </div>
                <div className="text-center">
                  <div className="text-[16px] font-bold text-[#111827]">{academy._count.users}</div>
                  <div>계정</div>
                </div>
                <div className="text-[11px] text-[#9ca3af]">
                  {new Date(academy.createdAt).toLocaleDateString('ko-KR')} 등록
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
