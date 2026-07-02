'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import clsx from 'clsx';
import {
  Users, BookOpen, Wallet, BarChart2,
  Settings, UserCheck, Calendar, Bell, TrendingUp, ClipboardList, CalendarPlus, History, ClipboardCheck, FileText,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';

type PermKey =
  | 'manageStudents' | 'manageClasses' | 'manageAttendance' | 'manageGrades'
  | 'manageQuestionBank'
  | 'manageFinance' | 'manageNotifications' | 'viewReports' | 'admin';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  perm?: PermKey; // 강사 권한 매핑 — 미지정 시 모든 강사 접근 가능(예: 캘린더)
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: '학생 관리',
    items: [
      { href: '/students', label: '학생 등록/정보 관리', icon: Users, perm: 'manageStudents' },
      { href: '/level-tests', label: '레벨 테스트', icon: ClipboardCheck, perm: 'manageGrades' },
      { href: '/questions', label: '문제 출제', icon: FileText, perm: 'manageQuestionBank' },
      { href: '/students/lessons', label: '수업 이력', icon: History, perm: 'manageGrades' },
    ],
  },
  {
    label: '반 운영',
    items: [
      { href: '/classes', label: '반 편성 및 시간표', icon: BookOpen, perm: 'manageClasses' },
      { href: '/classes/attendance', label: '출결 체크', icon: UserCheck, perm: 'manageAttendance' },
      { href: '/classes/lessons', label: '수업 관리', icon: ClipboardList, perm: 'manageGrades' },
      { href: '/classes/makeup', label: '보강 수업 관리', icon: CalendarPlus, perm: 'manageClasses' },
    ],
  },
  {
    label: '재무 관리',
    items: [
      { href: '/finance/billing', label: '청구/수납/미납', icon: Wallet, perm: 'manageFinance' },
      { href: '/finance/settlement', label: '정산 및 영수증', icon: TrendingUp, perm: 'manageFinance' },
    ],
  },
  {
    label: '소통 기능',
    items: [
      { href: '/communication/notifications', label: '알림 및 공지', icon: Bell, perm: 'manageNotifications' },
    ],
  },
  {
    label: '캘린더',
    items: [
      { href: '/calendar', label: '학원 일정', icon: Calendar },
    ],
  },
  {
    label: '통계 및 분석',
    items: [
      { href: '/analytics', label: '현황 리포트', icon: BarChart2, perm: 'viewReports' },
    ],
  },
  {
    label: '',
    items: [
      { href: '/settings', label: '설정', icon: Settings, perm: 'admin' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const isActive = (href: string) => {
    if (href === '/students') return pathname === '/students';
    if (href === '/classes') return pathname === '/classes';
    return pathname.startsWith(href);
  };

  // 강사 권한 필터 — director/super_admin·admin 강사는 전체 표시, 그 외 강사는 권한 보유 메뉴만
  const isTeacher = currentUser?.role === 'teacher';
  const perms = currentUser?.permissions;
  const canSee = (perm?: PermKey) => {
    if (!isTeacher) return true;
    if (perms?.admin) return true;
    if (!perm) return true;
    return !!perms?.[perm];
  };

  const visibleNav = NAV
    .map((section) => ({ ...section, items: section.items.filter((item) => canSee(item.perm)) }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className="shrink-0 flex flex-col overflow-y-auto"
      style={{ width: 185, backgroundColor: '#1a2535' }}
    >
      <div className="flex-1 py-3">
        {visibleNav.map((section) => (
          <div key={section.label || section.items[0]?.href} className="mb-1">
            {section.label && (
              <div className="px-4 py-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2 mx-2 px-3 py-2 rounded-[8px] text-[12px] transition-colors',
                    active
                      ? 'bg-[rgba(79,195,161,0.15)] text-[#4fc3a1] font-medium border-l-2 border-[#4fc3a1]'
                      : 'text-white/60 hover:text-white/80 hover:bg-white/5',
                  )}
                >
                  <Icon size={13} className="shrink-0" />
                  <span className="leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 text-[10px] text-white/30 border-t border-white/10">
        © 2026 학원로그
      </div>
    </aside>
  );
}
