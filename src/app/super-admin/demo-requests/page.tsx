'use client';
import { useState, useEffect } from 'react';
import { Inbox, Phone, Building2 } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

type Status = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED';

interface DemoRequest {
  id: string;
  name: string;
  phone: string;
  academyName: string;
  studentCount: string;
  message: string;
  status: Status;
  memo: string;
  createdAt: string;
}

const STATUS_META: Record<Status, { label: string; bg: string; color: string }> = {
  NEW: { label: '신규', bg: '#DBEAFE', color: '#1d4ed8' },
  CONTACTED: { label: '연락함', bg: '#FEF3C7', color: '#92400E' },
  CONVERTED: { label: '가입 전환', bg: '#D1FAE5', color: '#065f46' },
  CLOSED: { label: '종료', bg: '#F3F4F6', color: '#6b7280' },
};
const STATUS_ORDER: Status[] = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'];

export default function DemoRequestsPage() {
  const [items, setItems] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoDraft, setMemoDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/super-admin/demo-requests')
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        toast('상담 신청 목록을 불러오지 못했습니다.', 'error');
        setLoading(false);
      });
  }, []);

  const patch = async (id: string, body: { status?: Status; memo?: string }) => {
    const res = await fetch(`/api/super-admin/demo-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast('업데이트에 실패했습니다.', 'error');
      return;
    }
    const updated: DemoRequest = await res.json();
    setItems((list) => list.map((it) => (it.id === id ? updated : it)));
    toast('저장되었습니다.', 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-[#111827]">상담 신청</h1>
        <p className="text-[12.5px] text-[#6b7280] mt-0.5">마케팅 페이지(/intro)에서 들어온 데모/상담 신청입니다.</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[13px] text-[#9ca3af]">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-16 text-center">
          <Inbox size={40} className="text-[#d1d5db] mx-auto mb-3" />
          <p className="text-[13px] text-[#9ca3af]">아직 접수된 상담 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((it) => {
            const meta = STATUS_META[it.status];
            return (
              <div key={it.id} className="bg-white rounded-[12px] border border-[#e2e8f0] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-[10px] bg-[#1a2535] flex items-center justify-center">
                      <Inbox size={18} className="text-[#4fc3a1]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[#111827]">{it.name}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
                          style={{ backgroundColor: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[12px] text-[#6b7280] mt-1">
                        <span className="flex items-center gap-1"><Phone size={11} /> {it.phone}</span>
                        {it.academyName && <span className="flex items-center gap-1"><Building2 size={11} /> {it.academyName}</span>}
                        {it.studentCount && <span>· {it.studentCount}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#9ca3af] whitespace-nowrap">
                    {new Date(it.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>

                {it.message && (
                  <p className="text-[13px] text-[#374151] mt-3 bg-[#f9fafb] rounded-[8px] p-3 whitespace-pre-wrap">{it.message}</p>
                )}

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => it.status !== s && patch(it.id, { status: s })}
                      className={`text-[12px] px-3 py-1.5 rounded-[7px] border transition-colors cursor-pointer ${
                        it.status === s
                          ? 'border-transparent text-white bg-[#1a2535]'
                          : 'border-[#e2e8f0] text-[#6b7280] hover:border-[#4fc3a1]'
                      }`}
                    >
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    className="flex-1 text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 resize-none focus:outline-none focus:border-[#4fc3a1] focus:ring-1 focus:ring-[#4fc3a1]/20 transition-colors"
                    rows={2}
                    placeholder="메모 (예: 6/3 통화, 다음 주 데모 예정)"
                    value={memoDraft[it.id] ?? it.memo}
                    onChange={(e) => setMemoDraft((d) => ({ ...d, [it.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => patch(it.id, { memo: memoDraft[it.id] ?? it.memo })}
                    className="text-[12px] px-4 py-2 rounded-[8px] bg-[#f4f6f8] text-[#374151] border border-[#e2e8f0] hover:bg-[#e8ecef] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    메모 저장
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
