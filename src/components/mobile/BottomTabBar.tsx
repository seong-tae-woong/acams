'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Home, Bell, User } from 'lucide-react';
import clsx from 'clsx';
import { useMobileChild } from '@/contexts/MobileChildContext';
import { useMobileNotificationStore } from '@/lib/stores/mobileNotificationStore';

const TABS = [
  { href: '/mobile', label: '홈', icon: Home },
  { href: '/mobile/notifications', label: '알림', icon: Bell },
  { href: '/mobile/profile', label: '내 정보', icon: User },
];

const NOTIFICATIONS_HREF = '/mobile/notifications';

export default function BottomTabBar() {
  const pathname = usePathname();
  const { role } = useMobileChild();
  const unread = useMobileNotificationStore((s) => s.unread);
  const fetchUnread = useMobileNotificationStore((s) => s.fetchUnread);

  // 라우트 이동·마운트마다 실제 미읽음 수 재조회 (홈으로 돌아오면 정확히 반영).
  // 알림 페이지에서 알림을 읽으면 그 페이지가 스토어를 직접 갱신하므로 배지는 즉시 줄어든다.
  useEffect(() => {
    if (!role) return;
    fetchUnread();
  }, [pathname, role, fetchUnread]);

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-[#e2e8f0] flex z-50"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/mobile' && pathname.startsWith(href));
        const showBadge = href === NOTIFICATIONS_HREF && unread > 0;
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors',
              active ? 'text-[#4fc3a1]' : 'text-[#9ca3af]',
            )}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {showBadge && (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center"
                  aria-label={`${unread}개 미읽음 알림`}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
            <span className="text-[10.5px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
