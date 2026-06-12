'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import MobileContentLoader from '@/components/mobile/MobileContentLoader';
import { ChevronLeft, Bell, CreditCard, ChevronDown, ChevronUp, Loader2, CheckCheck } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import { useMobileChild } from '@/contexts/MobileChildContext';
import { useMobileNotificationStore } from '@/lib/stores/mobileNotificationStore';
import { requestTossPayment } from '@/lib/mobile/toss';

type NotificationType = '공지' | '출결알림' | '수납알림' | '상담알림' | '일반';

type NotificationItem = {
  id: string;
  studentId: string;
  studentName: string;
  type: NotificationType;
  title: string;
  content: string;
  sentAt: string;
  readAt: string | null;
  billIds: string[];
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

function parseTotalAmount(content: string): number | null {
  let match = content.match(/미납 총액:\s*([\d,]+)원/);
  if (match) return parseInt(match[1].replace(/,/g, ''), 10);
  match = content.match(/청구 총액:\s*([\d,]+)원/);
  if (match) return parseInt(match[1].replace(/,/g, ''), 10);
  return null;
}

function NotificationCard({
  notif,
  showChild,
  onRead,
}: {
  notif: NotificationItem;
  showChild: boolean;
  onRead: (n: NotificationItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const ts = TYPE_STYLE[notif.type] ?? TYPE_STYLE['일반'];
  const isPayment = notif.type === '수납알림';
  const totalAmount = isPayment ? parseTotalAmount(notif.content) : null;
  const hasBillIds = notif.billIds.length > 0;
  const isMissed = notif.content.includes('미납 총액');

  const preview = notif.content.split('\n').filter(Boolean)[0] ?? '';
  const hasMore = notif.content.length > preview.length;

  // 카드 탭 = 이 알림을 확인(읽음)했다는 신호. 펼침 토글도 함께 처리.
  const handleCardClick = () => {
    if (!notif.readAt) onRead(notif);
    if (hasMore) setExpanded((v) => !v);
  };

  const handlePay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notif.readAt) onRead(notif);
    if (!totalAmount || !hasBillIds) {
      toast('결제 정보를 확인할 수 없습니다.', 'error');
      return;
    }
    setPayLoading(true);
    try {
      await requestTossPayment({
        billIds: notif.billIds,
        amount: totalAmount,
        orderName: notif.title,
      });
      // 결제 완료 → successUrl로 이동 (여기는 도달 안 함)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '결제 중 오류가 발생했습니다.';
      toast(msg, 'error');
      setPayLoading(false);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      className={`bg-white rounded-[12px] border ${notif.readAt ? 'border-[#e2e8f0]' : 'border-[#4fc3a1]/40'} overflow-hidden cursor-pointer`}
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
            {showChild && notif.studentName && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#f1f5f9] text-[#475569]">
                {notif.studentName}
              </span>
            )}
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
          <span className="flex items-center gap-1 text-[11.5px] text-[#4fc3a1] font-medium mt-1.5">
            {expanded ? <><ChevronUp size={13} /> 접기</> : <><ChevronDown size={13} /> 자세히 보기</>}
          </span>
        )}
      </div>

      {/* 수납 알림 결제 버튼 */}
      {isPayment && (
        <div className="px-4 pb-4">
          <div className="border-t border-[#f1f5f9] pt-3">
            {totalAmount !== null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-[#6b7280]">{isMissed ? '미납 총액' : '청구 총액'}</span>
                  <span
                    className="font-bold text-[15px]"
                    style={{ color: isMissed ? '#991B1B' : '#0D9E7A' }}
                  >
                    {totalAmount.toLocaleString()}원
                  </span>
                </div>

                {hasBillIds ? (
                  // 청구서 ID 연결됨 → 토스 실결제
                  <button
                    disabled={payLoading}
                    onClick={handlePay}
                    className="w-full py-3 rounded-[10px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-60 cursor-pointer"
                    style={{ backgroundColor: isMissed ? '#991B1B' : '#4fc3a1' }}
                  >
                    {payLoading ? (
                      <><Loader2 size={16} className="animate-spin" /> 결제 준비 중...</>
                    ) : (
                      <><CreditCard size={16} /> {totalAmount.toLocaleString()}원 결제하기</>
                    )}
                  </button>
                ) : (
                  // billIds 없음 → 수납 내역 페이지로 이동
                  <Link href="/mobile/payments" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="w-full py-3 rounded-[10px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2 active:opacity-80 cursor-pointer"
                      style={{ backgroundColor: isMissed ? '#991B1B' : '#4fc3a1' }}
                    >
                      <CreditCard size={16} />
                      {totalAmount.toLocaleString()}원 결제하기
                    </button>
                  </Link>
                )}
              </div>
            ) : (
              <Link href="/mobile/payments" onClick={(e) => e.stopPropagation()}>
                <button
                  className="w-full py-3 rounded-[10px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2 active:opacity-80 cursor-pointer"
                  style={{ backgroundColor: '#4fc3a1' }}
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
  const { role, allChildren } = useMobileChild();
  const unread = useMobileNotificationStore((s) => s.unread);
  const setUnread = useMobileNotificationStore((s) => s.setUnread);
  const decrement = useMobileNotificationStore((s) => s.decrement);
  const fetchUnread = useMobileNotificationStore((s) => s.fetchUnread);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const showChild = allChildren.length > 1;

  // 역할이 정해지면 통합 피드 로드 (학부모=모든 자녀 병합, 학생=본인). 미읽음 수도 동기화.
  useEffect(() => {
    if (!role) return;
    setLoading(true);
    setNotifications([]);
    setPage(1);
    setHasMore(false);
    setError('');
    fetch('/api/mobile/notifications?page=1')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setNotifications(data.notifications ?? []);
        setHasMore(Boolean(data.hasMore));
      })
      .catch(() => setError('알림을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
    fetchUnread();
  }, [role, fetchUnread]);

  const loadMore = useCallback(() => {
    if (!role || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    fetch(`/api/mobile/notifications?page=${next}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setNotifications((prev) => [...prev, ...(data.notifications ?? [])]);
        setHasMore(Boolean(data.hasMore));
        setPage(next);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [role, page, hasMore, loadingMore]);

  // IntersectionObserver로 sentinel이 화면에 들어오면 다음 페이지 로드
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '120px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  // 알림 1건 읽음 처리 (낙관적 갱신 + 서버 반영)
  const markRead = useCallback((n: NotificationItem) => {
    if (n.readAt) return;
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id && x.studentId === n.studentId ? { ...x, readAt: nowIso } : x)),
    );
    decrement(1);
    fetch('/api/mobile/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: n.id, studentId: n.studentId }),
    }).catch(() => { fetchUnread(); });
  }, [decrement, fetchUnread]);

  // 모두 읽음 (로드되지 않은 알림 포함 — 서버가 일괄 처리)
  const markAllRead = useCallback(() => {
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: nowIso })));
    setUnread(0);
    fetch('/api/mobile/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => { fetchUnread(); });
  }, [setUnread, fetchUnread]);

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

  const FILTER_TYPES: Array<NotificationType | 'all'> = ['all', '수납알림', '출결알림', '공지', '일반'];
  const FILTER_LABELS: Record<string, string> = {
    all: '전체', '수납알림': '수납', '출결알림': '출결', '공지': '공지', '일반': '일반',
  };

  return (
    <div className="flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] min-h-screen">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/mobile">
            <ChevronLeft size={20} className="text-white" />
          </Link>
          <span className="text-[17px] font-bold text-white flex-1">알림</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/10 rounded-full text-[11.5px] font-medium text-white active:bg-white/20 cursor-pointer"
            >
              <CheckCheck size={13} /> 모두 읽음
            </button>
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

      <MobileContentLoader loading={loading}>
        <div className="px-4 py-4">
          {error ? (
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
                <NotificationCard key={`${n.id}-${n.studentId}`} notif={n} showChild={showChild} onRead={markRead} />
              ))}
              {/* 무한 스크롤 sentinel */}
              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                  {loadingMore && <Loader2 size={18} className="animate-spin text-[#9ca3af]" />}
                </div>
              )}
            </div>
          )}
        </div>
      </MobileContentLoader>

      <BottomTabBar />
    </div>
  );
}
