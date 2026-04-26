'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { ChevronLeft, Bell, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';

type NotificationType = '공지' | '출결알림' | '수납알림' | '상담알림' | '일반';

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  sentAt: string;
  readAt: string | null;
};

const TYPE_STYLE: Record<NotificationType, { bg: string; text: string }> = {
  '공지':    { bg: '#E1F5EE', text: '#0D9E7A' },
  '출결알림': { bg: '#DBEAFE', text: '#1d4ed8' },
  '수납알림': { bg: '#FEF3C7', text: '#92400E' },
  '상담알림': { bg: '#EDE9FE', text: '#5B4FBE' },
  '일반':    { bg: '#f1f5f9', text: '#374151' },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return `오늘 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 수납 알림 본문에서 청구/미납 총액 파싱 (결제 버튼에 표시)
function parseTotalAmount(content: string): number | null {
  // 미납 알림: "미납 총액: X원"
  let match = content.match(/미납 총액:\s*([\d,]+)원/);
  if (match) return parseInt(match[1].replace(/,/g, ''), 10);
  // 청구서 알림: "청구 총액: X원"
  match = content.match(/청구 총액:\s*([\d,]+)원/);
  if (match) return parseInt(match[1].replace(/,/g, ''), 10);
  return null;
}

function NotificationCard({ notif }: { notif: NotificationItem }) {
  const [expanded, setExpanded] = useState(false);
  const ts = TYPE_STYLE[notif.type] ?? TYPE_STYLE['일반'];
  const isPayment = notif.type === '수납알림';
  const totalAmount = isPayment ? parseTotalAmount(notif.content) : null;

  // 본문 첫 줄 미리보기
  const preview = notif.content.split('\n').filter(Boolean)[0] ?? '';
  const hasMore = notif.content.length > preview.length;

  return (
    <div
      className={`bg-white rounded-[12px] border ${notif.readAt ? 'border-[#e2e8f0]' : 'border-[#4fc3a1]/40'} overflow-hidden`}
      style={!notif.readAt ? { boxShadow: '0 0 0 2px #4fc3a120' } : {}}
    >
      {/* 상단 헤더 */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
              style={{ backgroundColor: ts.bg, color: ts.text }}
            >
              {notif.type}
            </span>
            {!notif.readAt && (
              <span className="w-2 h-2 rounded-full bg-[#4fc3a1] shrink-0 inline-block" />
            )}
          </div>
          <span className="text-[11px] text-[#9ca3af] shrink-0">{formatTime(notif.sentAt)}</span>
        </div>
        <div className="text-[14px] font-bold text-[#111827] mb-1">{notif.title}</div>

        {/* 본문 */}
        {expanded ? (
          <div className="text-[12.5px] text-[#374151] leading-relaxed whitespace-pre-line mt-2">
            {notif.content}
          </div>
        ) : (
          <div className="text-[12.5px] text-[#6b7280] line-clamp-2 mt-1">{preview}</div>
        )}

        {hasMore && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11.5px] text-[#4fc3a1] font-medium mt-1.5 cursor-pointer"
          >
            {expanded ? <><ChevronUp size={13} /> 접기</> : <><ChevronDown size={13} /> 자세히 보기</>}
          </button>
        )}
      </div>

      {/* 수납 알림 결제 버튼 */}
      {isPayment && (
        <div className="px-4 pb-4">
          <div className="border-t border-[#f1f5f9] pt-3">
            {totalAmount !== null ? (
              // 청구서 또는 미납 알림: 총액 표시 + 결제 버튼
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[#6b7280]">
                    {notif.content.includes('미납 총액') ? '미납 총액' : '청구 총액'}
                  </span>
                  <span
                    className="font-bold text-[15px]"
                    style={{ color: notif.content.includes('미납 총액') ? '#991B1B' : '#0D9E7A' }}
                  >
                    {totalAmount.toLocaleString()}원
                  </span>
                </div>
                <Link href="/mobile/payments">
                  <button
                    className="w-full py-3 rounded-[10px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2 active:opacity-80"
                    style={{ backgroundColor: notif.content.includes('미납 총액') ? '#991B1B' : '#4fc3a1' }}
                    onClick={() => toast('결제 페이지로 이동합니다. (결제 연동 예정)', 'info')}
                  >
                    <CreditCard size={16} />
                    {totalAmount.toLocaleString()}원 결제하기
                  </button>
                </Link>
              </div>
            ) : (
              // 총액 정보 없는 수납 알림
              <Link href="/mobile/payments">
                <button
                  className="w-full py-3 rounded-[10px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2 active:opacity-80"
                  style={{ backgroundColor: '#4fc3a1' }}
                  onClick={() => toast('결제 페이지로 이동합니다. (결제 연동 예정)', 'info')}
                >
                  <CreditCard size={16} />
                  결제하기
                </button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MobileNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');

  useEffect(() => {
    fetch('/api/mobile/notifications')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setNotifications(data.notifications ?? []);
      })
      .catch(() => setError('알림을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  const FILTER_TYPES: Array<NotificationType | 'all'> = ['all', '수납알림', '출결알림', '공지', '일반'];
  const FILTER_LABELS: Record<string, string> = {
    all: '전체', '수납알림': '수납', '출결알림': '출결', '공지': '공지', '일반': '일반',
  };

  return (
    <div className="flex flex-col pb-20 min-h-screen">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/mobile">
            <ChevronLeft size={20} className="text-white" />
          </Link>
          <span className="text-[17px] font-bold text-white flex-1">알림</span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-[#4fc3a1] rounded-full text-[11px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {/* 필터 탭 */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {FILTER_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filter === t
                  ? 'bg-[#4fc3a1] text-white'
                  : 'bg-white/10 text-white/70'
              }`}
            >
              {FILTER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-[13px] text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Bell size={36} className="text-[#d1d5db]" />
            <p className="text-[13px] text-[#9ca3af]">
              {filter === 'all' ? '받은 알림이 없습니다.' : `${FILTER_LABELS[filter]} 알림이 없습니다.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => (
              <NotificationCard key={n.id} notif={n} />
            ))}
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
