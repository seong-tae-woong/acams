'use client';
import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Building2, User, RefreshCw, Check, RotateCcw, Trash2, ChevronDown } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

interface ErrorLog {
  id: string;
  createdAt: string;
  source: string;
  academyId: string | null;
  academyName: string | null;
  userName: string | null;
  userId: string | null;
  userRole: string | null;
  code: string | null;
  message: string;
  meta: unknown;
  resolved: boolean;
}

type Filter = 'false' | 'all' | 'true';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'false', label: '미해결' },
  { key: 'all', label: '전체' },
  { key: 'true', label: '처리완료' },
];

const ROLE_LABEL: Record<string, string> = {
  director: '원장', teacher: '강사', super_admin: '슈퍼관리자',
  parent: '학부모', student: '학생', tablet: '태블릿',
};

export default function ErrorLogsPage() {
  const [items, setItems] = useState<ErrorLog[]>([]);
  const [unresolved, setUnresolved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('false');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const qs = f === 'all' ? '' : `?resolved=${f}`;
      const res = await fetch(`/api/super-admin/error-logs${qs}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.logs);
      setUnresolved(data.unresolvedCount);
    } catch {
      toast('에러 로그를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const toggleResolved = async (it: ErrorLog) => {
    const res = await fetch(`/api/super-admin/error-logs/${it.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !it.resolved }),
    });
    if (!res.ok) { toast('업데이트에 실패했습니다.', 'error'); return; }
    toast(it.resolved ? '미해결로 되돌렸습니다.' : '처리완료로 표시했습니다.', 'success');
    load(filter);
  };

  const remove = async (it: ErrorLog) => {
    const res = await fetch(`/api/super-admin/error-logs/${it.id}`, { method: 'DELETE' });
    if (!res.ok) { toast('삭제에 실패했습니다.', 'error'); return; }
    setItems((l) => l.filter((x) => x.id !== it.id));
    setUnresolved((n) => (it.resolved ? n : Math.max(0, n - 1)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#111827]">에러 로그</h1>
          <p className="text-[12.5px] text-[#6b7280] mt-0.5">
            서버에서 발생한 오류를 학원·작업자·원인별로 추적합니다. (운영진 전용)
            {unresolved > 0 && <span className="ml-2 text-[#991B1B] font-medium">미해결 {unresolved}건</span>}
          </p>
        </div>
        <button
          onClick={() => load(filter)}
          className="flex items-center gap-1.5 text-[12px] text-[#6b7280] hover:text-[#111827] border border-[#e2e8f0] rounded-[8px] px-3 py-1.5 bg-white transition-colors cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-[12.5px] px-3 py-1.5 rounded-[7px] border transition-colors cursor-pointer ${
              filter === f.key
                ? 'border-transparent text-white bg-[#1a2535]'
                : 'border-[#e2e8f0] text-[#6b7280] hover:border-[#4fc3a1] bg-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[13px] text-[#9ca3af]">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-16 text-center">
          <Check size={40} className="text-[#4fc3a1] mx-auto mb-3" />
          <p className="text-[13px] text-[#9ca3af]">
            {filter === 'false' ? '미해결 에러가 없습니다. 깨끗합니다 👍' : '표시할 에러 로그가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((it) => {
            const isOpen = expanded[it.id];
            const metaStr = it.meta ? JSON.stringify(it.meta, null, 2) : null;
            return (
              <div
                key={it.id}
                className={`bg-white rounded-[12px] border p-4 ${it.resolved ? 'border-[#e2e8f0] opacity-70' : 'border-[#FECACA]'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0 ${it.resolved ? 'bg-[#f1f5f9]' : 'bg-[#FEE2E2]'}`}>
                      <AlertTriangle size={17} className={it.resolved ? 'text-[#9ca3af]' : 'text-[#DC2626]'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#111827]">{it.source}</span>
                        {it.code && (
                          <span className="px-1.5 py-0.5 rounded-[5px] text-[10.5px] font-mono font-medium bg-[#FEF3C7] text-[#92400E]">
                            {it.code}
                          </span>
                        )}
                        {it.resolved && (
                          <span className="px-1.5 py-0.5 rounded-[5px] text-[10.5px] font-medium bg-[#D1FAE5] text-[#065f46]">처리완료</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11.5px] text-[#6b7280] mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 size={11} /> {it.academyName ?? it.academyId ?? '학원 불명'}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={11} /> {it.userName ?? '이름없음'}
                          {it.userRole && <span className="text-[#9ca3af]">({ROLE_LABEL[it.userRole] ?? it.userRole})</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-[#9ca3af] whitespace-nowrap mr-1">
                      {new Date(it.createdAt).toLocaleString('ko-KR')}
                    </span>
                    <button
                      onClick={() => toggleResolved(it)}
                      title={it.resolved ? '미해결로 되돌리기' : '처리완료로 표시'}
                      className="p-1.5 rounded-[6px] text-[#6b7280] hover:bg-[#f4f6f8] hover:text-[#065f46] transition-colors cursor-pointer"
                    >
                      {it.resolved ? <RotateCcw size={14} /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => remove(it)}
                      title="삭제"
                      className="p-1.5 rounded-[6px] text-[#9ca3af] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 에러 메시지 */}
                <p className="text-[12px] text-[#374151] mt-2.5 bg-[#f9fafb] rounded-[8px] px-3 py-2 font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {it.message}
                </p>

                {/* 상세(meta) */}
                {metaStr && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [it.id]: !e[it.id] }))}
                      className="flex items-center gap-1 text-[11.5px] text-[#6b7280] hover:text-[#111827] transition-colors cursor-pointer"
                    >
                      <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      상세 정보 (meta)
                    </button>
                    {isOpen && (
                      <pre className="mt-1.5 text-[11px] text-[#374151] bg-[#1a2535]/[0.03] border border-[#e2e8f0] rounded-[8px] p-3 overflow-x-auto whitespace-pre-wrap break-words">
                        {metaStr}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
