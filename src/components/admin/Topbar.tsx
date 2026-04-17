import type { ReactNode } from 'react';

interface TopbarProps {
  title: string;
  badge?: string;
  actions?: ReactNode;
}

export default function Topbar({ title, badge, actions }: TopbarProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-5 bg-white border-b border-[#e2e8f0]" style={{ height: 50 }}>
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-[#111827]">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 bg-[#f1f5f9] rounded-[20px] text-[11px] text-[#6b7280] font-medium">
            {badge}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
