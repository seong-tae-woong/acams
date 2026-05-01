'use client';
import { useEffect, useState } from 'react';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import Link from 'next/link';
import { useMobileChild } from '@/contexts/MobileChildContext';

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  classId: string | null;
  className: string | null;
};

export default function MobileAnnouncementsPage() {
  const { selectedChildId } = useMobileChild();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    fetch(`/api/mobile/announcements?studentId=${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setAnnouncements(data.announcements);
      })
      .catch(() => setError('데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  const selected = announcements.find((a) => a.id === selectedId);

  // 상세 보기
  if (selected) {
    return (
      <div className="flex flex-col pb-20 min-h-screen">
        <div className="bg-[#1a2535] px-4 pt-12 pb-4">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-2 text-white cursor-pointer"
          >
            <ChevronLeft size={20} />
            <span className="text-[15px] font-semibold">공지사항</span>
          </button>
        </div>
        <div className="flex-1 px-4 py-4">
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {selected.pinned && (
                <span className="flex items-center gap-1 text-[11px] text-[#0D9E7A] font-medium">
                  <Pin size={11} /> 중요 공지
                </span>
              )}
              {selected.className && (
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#DBEAFE] text-[#1d4ed8]">
                  {selected.className}
                </span>
              )}
            </div>
            <h2 className="text-[16px] font-bold text-[#111827] mb-2">{selected.title}</h2>
            <div className="text-[11.5px] text-[#9ca3af] mb-4">
              {(selected.publishedAt ?? selected.createdAt).slice(0, 10)}
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

  // 목록
  return (
    <div className="flex flex-col pb-20">
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">공지사항</span>
        </div>
      </div>

      <MobileContentLoader loading={loading}>
        <div className="px-4 py-4">
          {error ? (
            <div className="p-6 text-center text-[13px] text-red-400">{error}</div>
          ) : (
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] divide-y divide-[#f1f5f9]">
              {announcements.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="w-full px-4 py-4 text-left flex items-center gap-3 hover:bg-[#f9fafb] cursor-pointer"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mt-1"
                    style={{
                      backgroundColor: isRecent(a.publishedAt ?? a.createdAt)
                        ? '#4fc3a1'
                        : '#e2e8f0',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {a.pinned && <Pin size={11} className="text-[#4fc3a1] shrink-0" />}
                      {a.className && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#DBEAFE] text-[#1d4ed8] shrink-0">
                          {a.className}
                        </span>
                      )}
                      <span className="text-[13px] font-semibold text-[#111827] truncate">
                        {a.title}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-[#9ca3af]">
                      {(a.publishedAt ?? a.createdAt).slice(0, 10)}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#9ca3af] shrink-0" />
                </button>
              ))}
              {announcements.length === 0 && (
                <div className="p-8 text-center text-[13px] text-[#9ca3af]">공지사항 없음</div>
              )}
            </div>
          )}
        </div>
      </MobileContentLoader>
      <BottomTabBar />
    </div>
  );
}

function isRecent(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return now.getTime() - d.getTime() < 3 * 24 * 60 * 60 * 1000;
}
