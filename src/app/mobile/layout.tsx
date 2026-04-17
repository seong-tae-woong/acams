import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '세계로학원 — 학부모 앱',
  description: '학부모 및 학생을 위한 모바일 앱',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '세계로학원' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4fc3a1',
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f8] flex flex-col max-w-[430px] mx-auto relative">
      {children}
    </div>
  );
}
