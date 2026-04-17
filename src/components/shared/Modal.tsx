'use client';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={clsx('relative w-full mx-4 bg-white rounded-[10px] shadow-xl flex flex-col max-h-[90vh]', sizeMap[size])}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
          <span className="text-[14px] font-semibold text-[#111827]">{title}</span>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#374151] cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-[#e2e8f0] flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}
