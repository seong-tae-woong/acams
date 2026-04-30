'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const NAV = [
  {
    group: '강의 관리',
    items: [
      { label: '강의 목록',    href: '/ingang/lectures' },
      { label: '강의 등록',    href: '/ingang/lectures/new' },
      { label: '강의 분류/태그', href: '/ingang/lectures/tags' },
      { label: '수강 대상 지정', href: '/ingang/lectures/targets' },
    ],
  },
  {
    group: '시험 관리',
    items: [
      { label: '시험 출제',    href: '/ingang/exams' },
      { label: '이수 조건 설정', href: '/ingang/lectures/targets', tab: 'cond' },
      { label: '재응시 관리',  href: '/ingang/lectures/targets', tab: 'retry' },
    ],
  },
  {
    group: '이수 관리',
    items: [
      { label: '시청 현황',      href: '/ingang/completion' },
      { label: '시험 응시 현황',  href: '/ingang/completion', tab: 'exam' },
      { label: '이수율 통계',    href: '/ingang/completion/stats' },
      { label: '미이수 알림 발송', href: '/ingang/completion/notifications' },
      { label: '이수증 발급',    href: '/ingang/completion/notifications', tab: 'cert' },
    ],
  },
] as const;

// Tab-aware pages — active only when no tab present
const TAB_PAGES = [
  '/ingang/lectures/targets',
  '/ingang/completion',
  '/ingang/completion/notifications',
];

function SidebarInner() {
  const pathname  = usePathname();
  const sp        = useSearchParams();
  const curTab    = sp.get('tab');

  function isActive(item: { href: string; tab?: string }) {
    if (item.tab) return pathname === item.href && curTab === item.tab;
    if (TAB_PAGES.includes(item.href)) return pathname === item.href && !curTab;
    return pathname === item.href;
  }

  return (
    <aside
      className="shrink-0 flex flex-col overflow-y-auto"
      style={{ width: 185, background: '#1e1b2e' }}
    >
      <nav className="flex-1 py-2">
        {NAV.map((section) => (
          <div key={section.group}>
            <p
              className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(167,139,250,0.4)' }}
            >
              {section.group}
            </p>
            {section.items.map((item, i) => {
              const active = isActive(item);
              const href   = 'tab' in item ? `${item.href}?tab=${item.tab}` : item.href;
              return (
                <Link
                  key={i}
                  href={href}
                  className="block text-[12.5px] transition-colors hover:bg-white/[0.04]"
                  style={
                    active
                      ? {
                          padding: '8px 16px 8px 24px',
                          color: '#a78bfa',
                          background: 'rgba(167,139,250,0.15)',
                          borderLeft: '2px solid #a78bfa',
                        }
                      : {
                          padding: '8px 16px 8px 26px',
                          color: 'rgba(255,255,255,0.45)',
                        }
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div
        className="px-4 py-3 text-[10px] border-t"
        style={{ color: 'rgba(255,255,255,0.2)', borderColor: 'rgba(167,139,250,0.1)' }}
      >
        AcaMS 고객센터
      </div>
    </aside>
  );
}

export default function InGangSidebar() {
  return (
    <Suspense
      fallback={
        <aside
          className="shrink-0"
          style={{ width: 185, background: '#1e1b2e' }}
        />
      }
    >
      <SidebarInner />
    </Suspense>
  );
}
