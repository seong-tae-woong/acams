import type { ReactNode } from 'react';
import GNB from '@/components/admin/GNB';
import InGangSidebar from '@/components/ingang/InGangSidebar';
import ToastContainer from '@/components/shared/ToastContainer';

export default function InGangLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f4f6f8]">
      <GNB />
      <div className="flex flex-1 overflow-hidden">
        <InGangSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
