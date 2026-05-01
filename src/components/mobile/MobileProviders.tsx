'use client';
import { MobileChildProvider } from '@/contexts/MobileChildContext';

export default function MobileProviders({ children }: { children: React.ReactNode }) {
  return <MobileChildProvider>{children}</MobileChildProvider>;
}
