'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarCheck, BookOpen, Bell, User } from 'lucide-react';
import clsx from 'clsx';

const TABS = [
  { href: '/mobile', label: '홈', icon: Home },
  { href: '/mobile/attendance', label: '출결', icon: CalendarCheck },
  { href: '/mobile/grades', label: '리포트', icon: BookOpen },
  { href: '/mobile/notifications', label: '알림', icon: Bell },
  { href: '/mobile/profile', label: '내 정보', icon: User },
];

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-[#e2e8f0] flex z-50">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/mobile' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors',
              active ? 'text-[#4fc3a1]' : 'text-[#9ca3af]',
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10.5px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
