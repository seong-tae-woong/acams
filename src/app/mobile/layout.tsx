import type { Metadata, Viewport } from 'next';
import ToastContainer from '@/components/shared/ToastContainer';
import SwRegister from '@/components/mobile/SwRegister';
import MobileProviders from '@/components/mobile/MobileProviders';

export const metadata: Metadata = {
  title: 'AcaMS — 학부모·학생 앱',
  description: '학원 성적 리포트, 공지사항, 일정을 한눈에',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'AcaMS' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a2535',
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f8] flex flex-col max-w-[430px] mx-auto relative">
      <SwRegister />
      <MobileProviders>
        {children}
      </MobileProviders>
      <ToastContainer />
    </div>
  );
}
