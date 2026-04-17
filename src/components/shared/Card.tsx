import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export default function Card({ title, action, children, className, bodyClassName, noPadding }: CardProps) {
  return (
    <div className={clsx('bg-white rounded-[10px] border border-[#e2e8f0]', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
          {title && <span className="text-[13px] font-semibold text-[#111827]">{title}</span>}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={clsx(!noPadding && 'p-4', bodyClassName)}>{children}</div>
    </div>
  );
}
