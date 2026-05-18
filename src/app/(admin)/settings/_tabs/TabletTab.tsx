'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import { Plus, Tablet, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import { type TabletUser } from '../_shared';

export default function TabletTab() {
  // 태블릿 계정 관리
  const [tablets, setTablets] = useState<TabletUser[]>([]);
  const [tabletLoading, setTabletLoading] = useState(false);
  const [tabletAddOpen, setTabletAddOpen] = useState(false);
  const [tabletForm, setTabletForm] = useState({ name: '', password: '' });
  const [tabletAddLoading, setTabletAddLoading] = useState(false);
  const [tabletNewCred, setTabletNewCred] = useState<{ name: string; loginId: string; password: string } | null>(null);
  const [tabletPwVisible, setTabletPwVisible] = useState(false);

  useEffect(() => {
    setTabletLoading(true);
    fetch('/api/settings/tablets')
      .then((r) => r.ok ? r.json() : [])
      .then(setTablets)
      .finally(() => setTabletLoading(false));
  }, []);

  const handleTabletAdd = async () => {
    if (!tabletForm.name.trim() || !tabletForm.password.trim()) return;
    setTabletAddLoading(true);
    try {
      const res = await fetch('/api/settings/tablets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tabletForm),
      });
      // res.ok 확인 먼저, json() 파싱은 그 다음
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) { toast(data.error ?? '오류가 발생했습니다.', 'error'); return; }
      setTablets((prev) => [...prev, data]);
      setTabletNewCred({ name: data.name, loginId: data.loginId, password: data.password });
      setTabletAddOpen(false);
      setTabletForm({ name: '', password: '' });
    } catch (e) {
      console.error(e);
      toast('요청 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setTabletAddLoading(false);
    }
  };

  const handleTabletToggle = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/settings/tablets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      const data = await res.json();
      setTablets((prev) => prev.map((t) => t.id === id ? { ...t, ...data } : t));
      toast(isActive ? '태블릿을 활성화했습니다.' : '태블릿을 비활성화했습니다.', 'success');
    }
  };

  const handleTabletDelete = async (id: string) => {
    if (!confirm('태블릿 계정을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/settings/tablets/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTablets((prev) => prev.filter((t) => t.id !== id));
      toast('삭제되었습니다.', 'success');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#111827]">인강 태블릿 계정</p>
          <p className="text-[11px] text-[#9ca3af] mt-0.5">학원에 비치된 인강 전용 태블릿에 사용하는 계정입니다.</p>
        </div>
        <button
          onClick={() => { setTabletAddOpen(true); setTabletForm({ name: '', password: '' }); setTabletPwVisible(false); }}
          className="flex items-center gap-1.5 bg-[#1a2535] text-white text-[12px] font-medium px-3 py-2 rounded-[8px] hover:bg-[#263347] transition-colors cursor-pointer"
        >
          <Plus size={13} /> 태블릿 추가
        </button>
      </div>

      {tabletLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-[#4fc3a1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tablets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#9ca3af]">
          <Tablet size={32} className="mb-3 opacity-30" />
          <p className="text-[13px]">등록된 태블릿이 없습니다.</p>
          <p className="text-[11px] mt-1">태블릿 추가 버튼을 눌러 계정을 생성하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tablets.map((t) => (
            <div key={t.id} className="bg-white rounded-[10px] border border-[#e2e8f0] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1a2535] flex items-center justify-center shrink-0">
                <Tablet size={14} className="text-[#4fc3a1]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#111827] truncate">{t.name}</p>
                <p className="text-[11px] text-[#6b7280] font-mono mt-0.5">{t.loginId}</p>
              </div>
              <span className={clsx(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                t.isActive ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]',
              )}>
                {t.isActive ? '활성' : '비활성'}
              </span>
              <button
                onClick={() => handleTabletToggle(t.id, !t.isActive)}
                className="text-[11px] text-[#6b7280] hover:text-[#111827] border border-[#e2e8f0] rounded-[6px] px-2.5 py-1 cursor-pointer transition-colors"
              >
                {t.isActive ? '비활성화' : '활성화'}
              </button>
              <button
                onClick={() => handleTabletDelete(t.id)}
                className="text-[11px] text-red-400 hover:text-red-600 border border-red-200 rounded-[6px] px-2.5 py-1 cursor-pointer transition-colors"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 태블릿 추가 모달 */}
      <Modal open={tabletAddOpen} onClose={() => setTabletAddOpen(false)} title="인강 태블릿 추가">
        <div className="space-y-4">
          <div>
            <label className="block text-[12.5px] text-[#374151] font-medium mb-1.5">태블릿 별칭 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={tabletForm.name}
              onChange={(e) => setTabletForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="예) 1번 자리 태블릿"
              className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]"
            />
          </div>
          <div>
            <label className="block text-[12.5px] text-[#374151] font-medium mb-1.5">비밀번호 <span className="text-red-400">*</span></label>
            <div className="relative">
              <input
                type={tabletPwVisible ? 'text' : 'password'}
                value={tabletForm.password}
                onChange={(e) => setTabletForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="태블릿 로그인 비밀번호"
                className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 pr-9 focus:outline-none focus:border-[#4fc3a1]"
              />
              <button type="button" onClick={() => setTabletPwVisible((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] cursor-pointer">
                {tabletPwVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setTabletAddOpen(false)} className="flex-1 border border-[#e2e8f0] text-[#374151] text-[13px] py-2.5 rounded-[8px] cursor-pointer hover:bg-[#f4f6f8] transition-colors">취소</button>
            <button onClick={handleTabletAdd} disabled={tabletAddLoading || !tabletForm.name.trim() || !tabletForm.password.trim()} className="flex-1 bg-[#1a2535] text-white text-[13px] py-2.5 rounded-[8px] cursor-pointer hover:bg-[#263347] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {tabletAddLoading ? '생성 중...' : '생성'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 계정 생성 완료 모달 */}
      <Modal open={!!tabletNewCred} onClose={() => setTabletNewCred(null)} title="태블릿 계정 생성 완료">
        {tabletNewCred && (
          <div className="space-y-4">
            <p className="text-[12.5px] text-[#374151]">아래 정보를 태블릿에 입력하여 로그인하세요.</p>
            <div className="bg-[#f4f6f8] rounded-[10px] p-4 space-y-2.5">
              <div className="flex gap-2 text-[12.5px]">
                <span className="w-20 text-[#6b7280] shrink-0">별칭</span>
                <span className="font-semibold text-[#111827]">{tabletNewCred.name}</span>
              </div>
              <div className="flex gap-2 text-[12.5px]">
                <span className="w-20 text-[#6b7280] shrink-0">로그인 ID</span>
                <span className="font-mono font-medium text-[#111827] select-all">{tabletNewCred.loginId}</span>
              </div>
              <div className="flex gap-2 text-[12.5px]">
                <span className="w-20 text-[#6b7280] shrink-0">비밀번호</span>
                <span className="font-mono font-medium text-[#4fc3a1] select-all">{tabletNewCred.password}</span>
              </div>
            </div>
            <p className="text-[11px] text-[#9ca3af]">이 창을 닫으면 비밀번호를 다시 확인할 수 없습니다. 안전한 곳에 기록해두세요.</p>
            <button onClick={() => setTabletNewCred(null)} className="w-full bg-[#1a2535] text-white text-[13px] py-2.5 rounded-[8px] cursor-pointer hover:bg-[#263347] transition-colors">확인</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
