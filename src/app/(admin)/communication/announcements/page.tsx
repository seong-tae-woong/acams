'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import type { AnnouncementStatus } from '@/lib/types/notification';
import { Pin, Plus, Edit2 } from 'lucide-react';
import clsx from 'clsx';

const STATUS_STYLE: Record<AnnouncementStatus, { bg: string; text: string }> = {
  '게시됨':   { bg: '#D1FAE5', text: '#065f46' },
  '임시저장': { bg: '#FEF3C7', text: '#92400E' },
};

export default function AnnouncementsPage() {
  const { announcements } = useCommunicationStore();
  const [selectedId, setSelectedId] = useState<string | null>(announcements[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | 'all'>('all');

  const filtered = announcements.filter((a) => statusFilter === 'all' || a.status === statusFilter);
  const selected = announcements.find((a) => a.id === selectedId);

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    return iso.slice(0, 10);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="공지사항 발송"
        badge={`${announcements.filter((a) => a.status === '게시됨').length}건 게시 중`}
        actions={<Button variant="dark" size="sm"><Plus size={13} /> 공지 작성</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 공지 목록 */}
        <div className="w-64 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          <div className="p-2 border-b border-[#e2e8f0] flex gap-1.5">
            {(['all', '게시됨', '임시저장'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  'px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                  statusFilter === s ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]',
                )}
              >
                {s === 'all' ? '전체' : s}
              </button>
            ))}
          </div>
          <div className="divide-y divide-[#f1f5f9]">
            {filtered.map((a) => {
              const ss = STATUS_STYLE[a.status];
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={clsx(
                    'w-full text-left px-3 py-3 transition-colors cursor-pointer',
                    selectedId === a.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {a.pinned && <Pin size={11} className="text-[#4fc3a1] shrink-0" />}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: ss.bg, color: ss.text }}>
                      {a.status}
                    </span>
                  </div>
                  <div className="text-[12.5px] font-medium text-[#111827] line-clamp-2">{a.title}</div>
                  <div className="text-[11px] text-[#9ca3af] mt-0.5">{formatDate(a.publishedAt ?? a.createdAt)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우측: 공지 상세 */}
        {selected ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-5 max-w-2xl">
              {/* 헤더 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {selected.pinned && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[#E1F5EE] rounded text-[11px] text-[#065f46] font-medium">
                        <Pin size={10} /> 상단 고정
                      </span>
                    )}
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{ backgroundColor: STATUS_STYLE[selected.status].bg, color: STATUS_STYLE[selected.status].text }}
                    >
                      {selected.status}
                    </span>
                  </div>
                  <h2 className="text-[16px] font-bold text-[#111827]">{selected.title}</h2>
                  <div className="text-[12px] text-[#6b7280] mt-1">
                    작성자: {selected.author} · 작성일: {formatDate(selected.createdAt)}
                    {selected.publishedAt && ` · 게시일: ${formatDate(selected.publishedAt)}`}
                  </div>
                  <div className="text-[12px] text-[#6b7280] mt-0.5">
                    대상: {selected.targetAudience.includes('all') ? '전체' : selected.targetAudience.join(', ')}
                    {selected.status === '게시됨' && ` · 읽음 ${selected.readCount}/${selected.totalCount}명`}
                  </div>
                </div>
                <Button variant="default" size="sm"><Edit2 size={12} /> 수정</Button>
              </div>

              {/* 내용 */}
              <div className="border-t border-[#e2e8f0] pt-4">
                <div className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                  {selected.content}
                </div>
              </div>

              {/* 첨부파일 */}
              {selected.attachments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                  <div className="text-[12px] text-[#6b7280] mb-2">첨부파일</div>
                  {selected.attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2 text-[12px] text-[#374151]">
                      <span>{att.fileName}</span>
                      <span className="text-[#9ca3af]">({(att.fileSize / 1024).toFixed(1)}KB)</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 액션 버튼 */}
              {selected.status === '임시저장' && (
                <div className="mt-4 pt-4 border-t border-[#e2e8f0] flex gap-2">
                  <Button variant="dark" size="md" onClick={() => alert('공지가 게시되었습니다.')}>게시하기</Button>
                  <Button variant="default" size="md">저장</Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
            <p className="text-[13px] text-[#9ca3af]">공지사항을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
