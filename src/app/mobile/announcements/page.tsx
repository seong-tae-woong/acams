'use client';
import { useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import Link from 'next/link';

export default function MobileAnnouncementsPage() {
  const { announcements } = useCommunicationStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const published = announcements.filter((a) => a.status === '게시됨');
  const selected = published.find((a) => a.id === selectedId);

  if (selected) {
    return (
      <div className="flex flex-col pb-20 min-h-screen">
        <div className="bg-[#1a2535] px-4 pt-12 pb-4">
          <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-white cursor-pointer">
            <ChevronLeft size={20} />
            <span className="text-[15px] font-semibold">공지사항</span>
          </button>
        </div>
        <div className="flex-1 px-4 py-4">
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-5">
            {selected.pinned && (
              <span className="flex items-center gap-1 text-[11px] text-[#0D9E7A] font-medium mb-2">
                <Pin size={11} /> 중요 공지
              </span>
            )}
            <h2 className="text-[16px] font-bold text-[#111827] mb-2">{selected.title}</h2>
            <div className="text-[11.5px] text-[#9ca3af] mb-4">
              {selected.publishedAt?.slice(0, 10)} · 읽음 {selected.readCount}명
            </div>
            <div className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
              {selected.content}
            </div>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-20">
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">공지사항</span>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] divide-y divide-[#f1f5f9]">
          {published.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="w-full px-4 py-4 text-left flex items-center gap-3 hover:bg-[#f9fafb] cursor-pointer"
            >
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  {a.pinned && <Pin size={11} className="text-[#4fc3a1]" />}
                  <span className="text-[13px] font-semibold text-[#111827]">{a.title}</span>
                </div>
                <div className="text-[11.5px] text-[#9ca3af]">
                  {a.publishedAt?.slice(0, 10)} · 읽음 {a.readCount}/{a.totalCount}명
                </div>
              </div>
              <ChevronRight size={16} className="text-[#9ca3af] shrink-0" />
            </button>
          ))}
          {published.length === 0 && (
            <div className="p-8 text-center text-[13px] text-[#9ca3af]">공지사항 없음</div>
          )}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
