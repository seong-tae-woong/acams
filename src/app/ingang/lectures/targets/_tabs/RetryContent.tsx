'use client';
import { useState, useEffect } from 'react';
import { type RetryPending, type RetryHistory } from '../_shared';

// ─── Tab: 재응시 관리 ─────────────────────────────────────────
export function RetryContent() {
  const [pending,  setPending]  = useState<RetryPending[]>([]);
  const [history,  setHistory]  = useState<RetryHistory[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [allowing, setAllowing] = useState<string | null>(null); // quizId+studentId key

  const load = () => {
    setLoading(true);
    fetch('/api/ingang/retry')
      .then((r) => r.json())
      .then((data) => {
        setPending(Array.isArray(data.pending) ? data.pending : []);
        setHistory(Array.isArray(data.history) ? data.history : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAllow = async (quizId: string, studentId: string) => {
    const key = `${quizId}:${studentId}`;
    setAllowing(key);
    try {
      const res = await fetch('/api/ingang/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, studentId }),
      });
      if (!res.ok) throw new Error();
      load();
    } catch {
      alert('재응시 허용에 실패했습니다.');
    } finally {
      setAllowing(null);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-[13px] text-[#9ca3af]">불러오는 중...</div>;
  }

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535] flex items-center justify-between">
          재응시 요청 목록
          <span className="text-[12px] font-normal text-[#9ca3af]">최대 응시 횟수 초과 학생</span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['학생명','강의명','응시 횟수','최고 점수','상태','관리'].map((h) => (
                <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-[12.5px] text-[#9ca3af]">재응시 요청이 없습니다</td></tr>
            ) : pending.map((r) => {
              const key = `${r.quizId}:${r.studentId}`;
              return (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#111827] border-b border-[#f1f5f9]">{r.student}</td>
                  <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lectureTitle}</td>
                  <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#991b1b] border-b border-[#f1f5f9]">{r.tries}/{r.maxTries}회</td>
                  <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#991b1b] border-b border-[#f1f5f9]">{r.bestScore}점</td>
                  <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#FEE2E2', color: '#991b1b' }}>초과</span>
                  </td>
                  <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                    <button
                      onClick={() => handleAllow(r.quizId, r.studentId)}
                      disabled={allowing === key}
                      className="px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium text-white disabled:opacity-60"
                      style={{ background: '#5B4FBE' }}
                    >
                      {allowing === key ? '처리 중...' : '재응시 1회 허용'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#f1f5f9] text-[13px] font-semibold text-[#1a2535]">재응시 허용 이력</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['학생명','강의명','허용 일시','허용자','결과'].map((h) => (
                <th key={h} className="py-2.5 px-3.5 bg-[#f9fafb] text-[11.5px] font-semibold text-[#6b7280] text-left border-b border-[#e2e8f0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-[12.5px] text-[#9ca3af]">이력이 없습니다</td></tr>
            ) : history.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="py-2.5 px-3.5 text-[12.5px] font-semibold text-[#111827] border-b border-[#f1f5f9]">{r.student}</td>
                <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.lectureTitle}</td>
                <td className="py-2.5 px-3.5 text-[11.5px] text-[#6b7280] border-b border-[#f1f5f9]">
                  {new Date(r.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '.').replace('.', '')}
                </td>
                <td className="py-2.5 px-3.5 text-[12.5px] text-[#6b7280] border-b border-[#f1f5f9]">{r.allowedBy}</td>
                <td className="py-2.5 px-3.5 border-b border-[#f1f5f9]">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={r.passed ? { background: '#D1FAE5', color: '#065f46' } : { background: '#f1f5f9', color: '#6b7280' }}>
                    {r.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
