'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import type { NotificationType } from '@/lib/types/notification';
import { Send, Plus } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

const TYPE_STYLE: Record<NotificationType, { bg: string; text: string }> = {
  '공지':    { bg: '#E1F5EE', text: '#0D9E7A' },
  '출결알림': { bg: '#DBEAFE', text: '#1d4ed8' },
  '수납알림': { bg: '#FEF3C7', text: '#92400E' },
  '상담알림': { bg: '#EDE9FE', text: '#5B4FBE' },
  '일반':    { bg: '#f1f5f9', text: '#374151' },
};

const TYPES: NotificationType[] = ['공지', '출결알림', '수납알림', '상담알림', '일반'];

export default function NotificationsPage() {
  const { notifications } = useCommunicationStore();
  const { students } = useStudentStore();
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<NotificationType>('공지');

  const filtered = notifications.filter((n) => filter === 'all' || n.type === filter);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="학부모 알림"
        badge={`총 ${notifications.length}건`}
        actions={<Button variant="dark" size="sm" onClick={() => setComposing(true)}><Plus size={13} /> 알림 작성</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 발송 이력 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 타입 필터 */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={clsx(
                'px-3 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors cursor-pointer',
                filter === 'all' ? 'bg-[#1a2535] text-white border-transparent' : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f4f6f8]',
              )}
            >
              전체
            </button>
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={clsx(
                  'px-3 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors cursor-pointer',
                  filter === t ? 'bg-[#1a2535] text-white border-transparent' : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f4f6f8]',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 발송 이력 목록 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0]">
              <span className="text-[12.5px] font-semibold text-[#111827]">발송 이력</span>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {filtered.map((n) => {
                const ts = TYPE_STYLE[n.type];
                const readRate = n.totalCount > 0 ? Math.round((n.readCount / n.totalCount) * 100) : 0;
                return (
                  <div key={n.id} className="px-5 py-4 hover:bg-[#f9fafb]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium" style={{ backgroundColor: ts.bg, color: ts.text }}>
                            {n.type}
                          </span>
                          <span className="text-[11.5px] text-[#9ca3af]">{formatTime(n.sentAt)}</span>
                        </div>
                        <div className="text-[13px] font-semibold text-[#111827] mb-0.5">{n.title}</div>
                        <div className="text-[12px] text-[#6b7280] line-clamp-2">{n.content}</div>
                      </div>
                      <div className="ml-4 text-right shrink-0">
                        <div className="text-[12px] text-[#374151]">
                          <span className="font-semibold">{n.readCount}</span>/{n.totalCount}명 확인
                        </div>
                        <div className="mt-1 w-20 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden ml-auto">
                          <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${readRate}%` }} />
                        </div>
                        <div className="text-[10.5px] text-[#9ca3af] mt-0.5">{readRate}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측: 알림 작성 패널 */}
        {composing && (
          <div className="w-80 shrink-0 border-l border-[#e2e8f0] bg-white overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-semibold text-[#111827]">알림 작성</span>
              <button onClick={() => setComposing(false)} className="text-[#9ca3af] hover:text-[#374151] cursor-pointer text-[18px]">×</button>
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">유형</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as NotificationType)}
                className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">제목</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="알림 제목"
                className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1]"
              />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">내용</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="알림 내용을 입력하세요"
                rows={5}
                className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1] resize-none"
              />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">수신 대상</label>
              <div className="p-2.5 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#374151]">
                전체 학부모 ({students.filter((s) => s.status === '재원').length}명)
              </div>
            </div>
            <Button
              variant="dark"
              size="md"
              onClick={() => { toast('알림이 성공적으로 발송되었습니다.', 'success'); setComposing(false); setNewTitle(''); setNewContent(''); }}
            >
              <Send size={13} /> 발송
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
