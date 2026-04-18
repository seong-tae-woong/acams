'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { mockReceipts } from '@/lib/mock/finance';
import { formatKoreanDate } from '@/lib/utils/format';
import { FileDown, Printer } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

const METHOD_STYLE: Record<string, { bg: string; text: string }> = {
  '카드':    { bg: '#DBEAFE', text: '#1d4ed8' },
  '계좌이체': { bg: '#E1F5EE', text: '#065f46' },
  '현금':    { bg: '#FEF3C7', text: '#92400E' },
};

export default function ReceiptsPage() {
  const [search, setSearch] = useState('');

  const filtered = mockReceipts.filter((r) =>
    !search || r.studentName.includes(search),
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="수납 영수증 이력"
        badge={`${mockReceipts.length}건`}
        actions={
          <Button variant="default" size="sm" onClick={() => toast('영수증 목록을 CSV로 내보냅니다. (추후 연동 예정)', 'info')}><FileDown size={13} /> 전체 내보내기</Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-3">
            <input
              type="text"
              placeholder="학생 이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-1.5 w-40 focus:outline-none focus:border-[#4fc3a1]"
            />
            <span className="text-[12px] text-[#6b7280] ml-auto">{filtered.length}건</span>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-[#f4f6f8]">
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">영수증 번호</th>
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">학생</th>
                <th className="text-right px-4 py-2.5 text-[#6b7280] font-medium">금액</th>
                <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">납부 방법</th>
                <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium">발급일</th>
                <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">메모</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.map((r) => {
                const ms = METHOD_STYLE[r.method] ?? { bg: '#f1f5f9', text: '#6b7280' };
                return (
                  <tr key={r.id} className="hover:bg-[#f9fafb]">
                    <td className="px-4 py-3 text-[#9ca3af] font-mono text-[11.5px]">{r.id.toUpperCase()}</td>
                    <td className="px-4 py-3 font-medium text-[#111827]">{r.studentName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#111827]">{r.amount.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="px-2.5 py-0.5 rounded-[20px] text-[11px] font-medium"
                        style={{ backgroundColor: ms.bg, color: ms.text }}
                      >
                        {r.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-[#374151]">{formatKoreanDate(r.issuedDate)}</td>
                    <td className="px-4 py-3 text-[#6b7280]">{r.memo || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="default" size="sm" onClick={() => toast(`영수증 ${r.id.toUpperCase()} 출력 중...`, 'info')}>
                        <Printer size={12} /> 출력
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
