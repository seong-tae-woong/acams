import type { ReactNode } from 'react';
import ToastContainer from '@/components/shared/ToastContainer';
import SuperAdminHeader from './SuperAdminHeader';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      <SuperAdminHeader />
      <main className="max-w-5xl mx-auto p-6">{children}</main>
      <ToastContainer />
    </div>
  );
}
