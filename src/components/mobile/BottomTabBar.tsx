'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, CalendarCheck, BookOpen, Bell, User } from 'lucide-react';
import clsx from 'clsx';
import { useMobileChild } from '@/contexts/MobileChildContext';

const TABS = [
  { href: '/mobile', label: '홈', icon: Home },
  { href: '/mobile/attendance', label: '출결', icon: CalendarCheck },
  { href: '/mobile/grades', label: '리포트', icon: BookOpen },
  { href: '/mobile/notifications', label: '알림', icon: Bell },
  { href: '/mobile/profile', label: '내 정보', icon: User },
];

const NOTIFICATIONS_HREF = '/mobile/notifications';

export default function BottomTabBar() {
  const pathname = usePathname();
  const { selectedChildId } = useMobileChild();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!selectedChildId) {
      setUnread(0);
      return;
    }
    // 알림 탭에 들어오면 즉시 0으로 표시 (서버는 첫 페이지 진입 시 일괄 read 처리됨)
    if (pathname === NOTIFICATIONS_HREF) {
      setUnread(0);
      return;
    }
    fetch(`/api/mobile/notifications/unread-count?studentId=${selectedChildId}`)
      .then((r) => r.json())
      .then((data) => setUnread(typeof data.count === 'number' ? data.count : 0))
      .catch(() => setUnread(0));
  }, [pathname, selectedChildId]);

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-[#e2e8f0] flex z-50">
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
