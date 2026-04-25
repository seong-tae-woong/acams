'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, BookOpen, ToggleLeft, ToggleRight, KeyRound, Save } from 'lucide-react';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

interface AcademyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface AcademyDetail {
  id: string;
  name: string;
  slug: string;
  loginKey: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { students: number; classes: number };
  users: AcademyUser[];
}

const ROLE_LABEL: Record<string, string> = {
  director: '원장',
  teacher: '강사',
  parent: '학부모',
  student: '학생',
  super_admin: '슈퍼어드민',
};

const ROLE_COLOR: Record<string, string> = {
  director: '#1a2535',
  teacher: '#4f46e5',
  parent: '#0891b2',
  student: '#059669',
};

export default function AcademyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [academy, setAcademy] = useState<AcademyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 학원 정보 편집 폼
  const [editForm, setEditForm] = useState({ name: '', loginKey: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  // 비밀번호 초기화
  const [pwState, setPwState] = useState<Record<string, { open: boolean; value: string; loading: boolean }>>({});

  useEffect(() => {
    fetch(`/api/super-admin/academies/${id}`)
      .then((r) => r.json())
      .then((data: AcademyDetail) => {
        setAcademy(data);
        setEditForm({ name: data.name, loginKey: data.loginKey ?? '', phone: data.phone ?? '', address: data.address ?? '' });
        setLoading(false);
      })
      .catch(() => {
        toast('학원 정보를 불러오지 못했습니다.', 'error');
        setLoading(false);
      });
  }, [id]);

  // 학원 정보 저장
  const handleSaveInfo = async () => {
    if (!editForm.name.trim()) {
      toast('학원명을 입력해주세요.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/academies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? '저장에 실패했습니다.', 'error'); return; }
      setAcademy((prev) => prev ? { ...prev, name: data.name, loginKey: data.loginKey, phone: data.phone, address: data.address } : prev);
      toast('학원 정보가 저장되었습니다.', 'success');
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 활성/비활성 토글
  const handleToggleAcademy = async () => {
    if (!academy) return;
    const next = !academy.isActive;
    try {
      const res = await fetch(`/api/super-admin/academies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) { toast('상태 변경에 실패했습니다.', 'error'); return; }
      setAcademy((prev) => prev ? { ...prev, isActive: next } : prev);
      toast(next ? '학원이 활성화되었습니다.' : '학원이 비활성화되었습니다.', 'success');
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    }
  };

  // 계정 활성/비활성 토글
  const handleToggleUser = async (user: AcademyUser) => {
    const next = !user.isActive;
    try {
      const res = await fetch(`/api/super-admin/academies/${id}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) { toast('계정 상태 변경에 실패했습니다.', 'error'); return; }
      setAcademy((prev) => prev ? {
        ...prev,
        users: prev.users.map((u) => u.id === user.id ? { ...u, isActive: next } : u),
      } : prev);
      toast(`${user.name} 계정이 ${next ? '활성화' : '비활성화'}되었습니다.`, 'success');
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    }
  };

  // 비밀번호 초기화
  const handleResetPassword = async (user: AcademyUser) => {
    const pw = pwState[user.id]?.value ?? '';
    if (pw.length < 8) { toast('비밀번호는 8자 이상이어야 합니다.', 'error'); return; }
    setPwState((s) => ({ ...s, [user.id]: { ...s[user.id], loading: true } }));
    try {
      const res = await fetch(`/api/super-admin/academies/${id}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pw }),
      });
      if (!res.ok) { toast('비밀번호 초기화에 실패했습니다.', 'error'); return; }
      setPwState((s) => ({ ...s, [user.id]: { open: false, value: '', loading: false } }));
      toast(`${user.name} 비밀번호가 초기화되었습니다.`, 'success');
    } catch {
      toast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setPwState((s) => ({ ...s, [user.id]: { ...s[user.id], loading: false } }));
    }
  };

  const fieldCls = 'w-full text-[13px] border border-[#e2e8f0] rounded-[10px] px-4 py-2.5 focus:outline-none focus:border-[#4fc3a1] focus:ring-2 focus:ring-[#4fc3a1]/20 transition-colors';

  if (loading) {
    return (
      <div className="text-center py-20 text-[13px] text-[#9ca3af]">불러오는 중...</div>
    );
  }

  if (!academy) {
    return (
      <div className="text-center py-20 text-[13px] text-[#9ca3af]">학원을 찾을 수 없습니다.</div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/super-admin" className="text-[#6b7280] hover:text-[#111827] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[18px] font-bold text-[#111827]">{academy.name}</h1>
          <span
            className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
            style={academy.isActive
              ? { backgroundColor: '#D1FAE5', color: '#065f46' }
              : { backgroundColor: '#F3F4F6', color: '#6b7280' }
            }
          >
            {academy.isActive ? '운영중' : '비활성'}
          </span>
        </div>
      </div>

      {/* 통계 칩 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e2e8f0] rounded-[8px] text-[12.5px] text-[#374151]">
          <Users size={13} className="text-[#9ca3af]" />
          <span>학생 <strong>{academy._count.students}</strong>명</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e2e8f0] rounded-[8px] text-[12.5px] text-[#374151]">
          <BookOpen size={13} className="text-[#9ca3af]" />
          <span>반 <strong>{academy._count.classes}</strong>개</span>
        </div>
        <div className="text-[11.5px] text-[#9ca3af] ml-auto">
          slug: {academy.slug} · {new Date(academy.createdAt).toLocaleDateString('ko-KR')} 등록
        </div>
      </div>

      {/* 섹션 A: 학원 정보 편집 */}
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[#374151]">학원 정보</h2>
          {/* 활성 상태 토글 */}
          <button
            onClick={handleToggleAcademy}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors',
              academy.isActive
                ? 'bg-[#FEE2E2] text-[#991b1b] hover:bg-[#FECACA]'
                : 'bg-[#D1FAE5] text-[#065f46] hover:bg-[#A7F3D0]'
            )}
          >
            {academy.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {academy.isActive ? '비활성화' : '활성화'}
          </button>
        </div>

        <div className="grid gap-3">
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">학원명 *</label>
            <input
              className={fieldCls}
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="학원명"
            />
          </div>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">
              학원 키 (영문 대문자 3글자)
              {academy.loginKey && (
                <span className="ml-2 text-[11px] font-mono bg-[#D1FAE5] text-[#065f46] px-1.5 py-0.5 rounded">현재: {academy.loginKey}</span>
              )}
            </label>
            <input
              className={fieldCls}
              value={editForm.loginKey}
              onChange={(e) => setEditForm((f) => ({ ...f, loginKey: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) }))}
              placeholder="예: SGR"
              maxLength={3}
            />
            <p className="text-[11px] text-[#9ca3af] mt-1">학생 로그인 ID 앞에 붙는 접두어입니다. 한 번 설정 후 변경하면 기존 학생 로그인 ID가 바뀝니다.</p>
          </div>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">대표 전화</label>
            <input
              className={fieldCls}
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="예: 02-1234-5678"
            />
          </div>
          <div>
            <label className="block text-[12px] text-[#6b7280] mb-1.5">주소</label>
            <input
              className={fieldCls}
              value={editForm.address}
              onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="예: 서울시 강남구 ..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="dark" size="sm" onClick={handleSaveInfo}>
            <Save size={13} />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {/* 섹션 B: 계정 관리 */}
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-[#374151]">계정 관리</h2>

        {academy.users.length === 0 ? (
          <p className="text-[12.5px] text-[#9ca3af] py-4 text-center">등록된 계정이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {academy.users.map((user) => {
              const pw = pwState[user.id] ?? { open: false, value: '', loading: false };
              return (
                <div key={user.id} className="border border-[#e2e8f0] rounded-[10px] overflow-hidden">
                  {/* 계정 행 */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#111827]">{user.name}</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                          style={{ backgroundColor: ROLE_COLOR[user.role] ?? '#6b7280' }}
                        >
                          {ROLE_LABEL[user.role] ?? user.role}
                        </span>
                        {!user.isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#F3F4F6] text-[#6b7280]">비활성</span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-[#9ca3af] mt-0.5">{user.email}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* 비밀번호 초기화 버튼 */}
                      <button
                        onClick={() => setPwState((s) => ({
                          ...s,
                          [user.id]: { open: !pw.open, value: '', loading: false },
                        }))}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11.5px] text-[#6b7280] border border-[#e2e8f0] hover:border-[#4fc3a1] hover:text-[#4fc3a1] transition-colors"
                      >
                        <KeyRound size={11} />
                        비밀번호 초기화
                      </button>

                      {/* 활성/비활성 토글 */}
                      <button
                        onClick={() => handleToggleUser(user)}
                        className={clsx(
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11.5px] font-medium transition-colors',
                          user.isActive
                            ? 'bg-[#F3F4F6] text-[#6b7280] hover:bg-[#FEE2E2] hover:text-[#991b1b]'
                            : 'bg-[#D1FAE5] text-[#065f46] hover:bg-[#A7F3D0]'
                        )}
                      >
                        {user.isActive ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                        {user.isActive ? '비활성화' : '활성화'}
                      </button>
                    </div>
                  </div>

                  {/* 비밀번호 초기화 인라인 폼 */}
                  {pw.open && (
                    <div className="border-t border-[#e2e8f0] bg-[#f9fafb] px-4 py-3 flex items-center gap-2">
                      <input
                        type="password"
                        className="flex-1 text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] focus:ring-1 focus:ring-[#4fc3a1]/20"
                        placeholder="새 비밀번호 (8자 이상)"
                        value={pw.value}
                        onChange={(e) => setPwState((s) => ({
                          ...s,
                          [user.id]: { ...s[user.id], value: e.target.value },
                        }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleResetPassword(user)}
                      />
                      <Button
                        variant="dark"
                        size="sm"
                        onClick={() => handleResetPassword(user)}
                      >
                        {pw.loading ? '처리 중...' : '변경'}
                      </Button>
                      <button
                        onClick={() => setPwState((s) => ({ ...s, [user.id]: { open: false, value: '', loading: false } }))}
                        className="text-[12px] text-[#9ca3af] hover:text-[#374151] px-1"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
