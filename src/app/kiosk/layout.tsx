import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '세계로학원 — 출결 키오스크',
  description: '태블릿 출결 체크 키오스크',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f1a2b] flex flex-col">
      {children}
    </div>
  );
}
