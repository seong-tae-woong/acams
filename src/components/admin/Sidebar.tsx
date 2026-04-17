'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  Users, BookOpen, Wallet, MessageSquare, BarChart2,
  Settings, ClipboardList, UserCheck, GraduationCap,
  BookMarked, Calendar, Bell, FileText, TrendingUp, CalendarDays,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: '학생 관리',
    items: [
      { href: '/students', label: '학생 등록/정보 관리', icon: Users },
      { href: '/students/attendance', label: '출결 현황', icon: ClipboardList },
      { href: '/students/grades', label: '성적/시험 결과', icon: GraduationCap },
      { href: '/students/report', label: '학생 리포트', icon: FileText },
    ],
  },
  {
    label: '수업 관리',
    items: [
      { href: '/classes', label: '반 편성 및 시간표', icon: BookOpen },
      { href: '/classes/attendance', label: '출결 체크', icon: UserCheck },
      { href: '/classes/teachers', label: '강사 배정', icon: Users },
      { href: '/classes/curriculum', label: '교재 및 커리큘럼', icon: BookMarked },
      { href: '/classes/makeup', label: '보강 수업 관리', icon: CalendarDays },
    ],
  },
  {
    label: '재무 관리',
    items: [
      { href: '/finance/billing', label: '수강료 청구 및 수납', icon: Wallet },
      { href: '/finance/payments', label: '수납 관리', icon: Wallet },
      { href: '/finance/overdue', label: '미납 관리', icon: Wallet },
      { href: '/finance/settlement', label: '매출/지출 정산', icon: TrendingUp },
      { href: '/finance/receipts', label: '영수증 이력', icon: FileText },
    ],
  },
  {
    label: '소통 기능',
    items: [
      { href: '/communication/notifications', label: '학부모 알림', icon: Bell },
      { href: '/communication/consultation', label: '상담 기록 관리', icon: MessageSquare },
      { href: '/communication/announcements', label: '공지사항 발송', icon: FileText },
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
      { href: '/analytics', label: '현황 리포트', icon: BarChart2 },
    ],
  },
  {
    label: '설정',
    items: [
      { href: '/settings', label: '계정 관리', icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/students') return pathname === '/students';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="shrink-0 flex flex-col overflow-y-auto"
      style={{ width: 185, backgroundColor: '#1a2535' }}
    >
      <div className="flex-1 py-3">
        {NAV.map((section) => (
          <div key={section.label} className="mb-1">
            <div className="px-4 py-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {section.label}
            </div>
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
        © 2026 AcaMS
      </div>
    </aside>
  );
}
