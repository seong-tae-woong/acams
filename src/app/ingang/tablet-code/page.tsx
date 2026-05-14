'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Tablet, Info } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

export default function TabletCodePage() {
  const [code,     setCode]     = useState<string | null>(null);
  const [date,     setDate]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [rotating, setRotating] = useState(false);

  const loadCode = async () => {
    try {
      const res = await fetch('/api/ingang-tablet/daily-code');
      if (res.ok) { const d = await res.json(); setCode(d.code); setDate(d.date); }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadCode(); }, []);

  const rotate = async () => {
    if (!confirm('오늘 인증 코드를 새로 발급하시겠습니까?\n현재 코드는 즉시 사용 불가 상태가 됩니다.')) return;
    setRotating(true);
    try {
      const res = await fetch('/api/ingang-tablet/daily-code', { method: 'POST' });
      if (res.ok) { const d = await res.json(); setCode(d.code); setDate(d.date); toast('새 코드가 발급되었습니다.', 'success'); }
    } finally { setRotating(false); }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast('코드를 복사했습니다.', 'success');
  };

  const dateLabel = date
    ? new Date(date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#f4f6f8]">
      {/* 헤더 */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 shrink-0 flex items-center gap-3">
        <Tablet size={18} className="text-[#a78bfa]" />
        <h1 className="text-[15px] font-bold text-[#111827]">일일 인증 코드</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md space-y-4">

          {/* 코드 카드 */}
          <div className="bg-white rounded-[14px] border border-[#e2e8f0] p-6 text-center shadow-sm">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-8 h-8 border-3 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-[11px] text-[#9ca3af] mb-2 font-medium tracking-wider uppercase">{dateLabel} 인증 코드</p>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="text-[48px] font-mono font-bold text-[#1a2535] tracking-[0.15em]">
                    {code}
                  </span>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1.5 text-[12.5px] text-[#6b7280] hover:text-[#111827] border border-[#e2e8f0] rounded-[8px] px-3 py-2 cursor-pointer transition-colors"
                  >
                    <Copy size={13} /> 복사
                  </button>
                  <button
                    onClick={rotate}
                    disabled={rotating}
                    className="flex items-center gap-1.5 text-[12.5px] text-white bg-[#a78bfa] hover:bg-[#9370e8] border border-transparent rounded-[8px] px-3 py-2 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={13} className={rotating ? 'animate-spin' : ''} />
                    새 코드 발급
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 안내 카드 */}
          <div className="bg-[#f4f6f8] rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-[#a78bfa] shrink-0 mt-0.5" />
              <div className="text-[12px] text-[#6b7280] space-y-1.5">
                <p>• 코드는 매일 자정에 자동으로 발급됩니다.</p>
                <p>• 학생이 출결번호를 입력한 후 강사가 이 코드를 입력하면 인강 시청이 시작됩니다.</p>
                <p>• "새 코드 발급" 시 기존 코드는 즉시 무효가 됩니다.</p>
                <p>• 코드는 학원 강사 및 원장만 확인할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
