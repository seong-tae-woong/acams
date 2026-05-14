import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '인강 시청',
  description: '인강 전용 태블릿 화면',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
};

export default function IngangTabletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f1a2b] flex flex-col select-none">
      {children}
    </div>
  );
}
