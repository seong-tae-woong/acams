'use client';
import { useToastStore } from '@/lib/stores/toastStore';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

const CONFIG = {
  success: { icon: CheckCircle, bg: '#D1FAE5', text: '#065f46', border: '#A7F3D0' },
  error:   { icon: XCircle,     bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  info:    { icon: Info,         bg: '#DBEAFE', text: '#1d4ed8', border: '#BFDBFE' },
  warning: { icon: AlertTriangle, bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const { icon: Icon, bg, text, border } = CONFIG[t.type];
        return (
          <div
            key={t.id}
            className="flex items-center gap-3 px-4 py-3 rounded-[10px] shadow-lg border pointer-events-auto min-w-[240px] max-w-[360px] animate-in fade-in slide-in-from-right-4 duration-200"
            style={{ backgroundColor: bg, borderColor: border }}
          >
            <Icon size={16} style={{ color: text }} className="shrink-0" />
            <span className="text-[13px] font-medium flex-1" style={{ color: text }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 cursor-pointer opacity-60 hover:opacity-100"
              style={{ color: text }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
