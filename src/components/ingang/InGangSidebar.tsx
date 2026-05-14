'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const NAV = [
  {
    group: '강의 관리',
    items: [
      { label: '강의 목록',    href: '/ingang/lectures' },
      { label: '강의 등록',    href: '/ingang/lectures/new' },
      { label: '강의 세부사항', href: '/ingang/lectures/targets' },
      { label: '학생별 코멘트', href: '/ingang/lectures/student-notes' },
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
  {
    group: '태블릿 운영',
    items: [
      { label: '일일 인증 코드', href: '/ingang/tablet-code' },
    ],
  },
] as const;

// Tab-aware pages — active only when no tab present
const TAB_PAGES = [
  '/ingang/completion',
  '/ingang/completion/notifications',
];

function DailyCodeWidget() {
  const [code, setCode]         = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const loadCode = async () => {
    try {
      const res = await fetch('/api/ingang-tablet/daily-code');
      if (res.ok) { const d = await res.json(); setCode(d.code); }
    } catch { /* ignore */ }
  };

  useEffect(() => { loadCode(); }, []);

  const rotate = async () => {
    setRotating(true);
    try {
      const res = await fetch('/api/ingang-tablet/daily-code', { method: 'POST' });
      if (res.ok) { const d = await res.json(); setCode(d.code); }
    } finally { setRotating(false); }
  };

  if (!code) return null;

  return (
    <div
      className="mx-3 mb-3 rounded-[10px] p-3"
      style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.18)' }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(167,139,250,0.5)' }}>
        오늘 인증 코드
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[#a78bfa] text-[20px] font-mono font-bold tracking-[0.12em] flex-1">{code}</span>
        <button
          onClick={rotate}
          disabled={rotating}
          title="새 코드 발급"
          className="text-white/30 hover:text-[#a78bfa] disabled:opacity-40 cursor-pointer transition-colors"
        >
          <RefreshCw size={13} className={rotating ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
}

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

      {/* 일일 인증 코드 위젯 */}
      <DailyCodeWidget />

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
