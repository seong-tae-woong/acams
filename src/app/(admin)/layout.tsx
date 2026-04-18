import type { ReactNode } from 'react';
import GNB from '@/components/admin/GNB';
import Sidebar from '@/components/admin/Sidebar';
import ToastContainer from '@/components/shared/ToastContainer';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f4f6f8]">
      <GNB />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
