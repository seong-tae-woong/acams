import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'dark' | 'primary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const variantMap: Record<Variant, string> = {
  default: 'bg-white border border-[#e2e8f0] text-[#374151] hover:bg-[#f4f6f8]',
  dark: 'bg-[#1a2535] text-white hover:bg-[#243347]',
  primary: 'bg-[#4fc3a1] text-white hover:bg-[#0D9E7A]',
  danger: 'bg-[#FEE2E2] text-[#991B1B] hover:bg-red-200',
  ghost: 'text-[#374151] hover:bg-[#f1f5f9]',
};

const sizeMap: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-[11.5px]',
  md: 'px-3.5 py-1.5 text-[12.5px]',
  lg: 'px-4 py-2 text-[13px]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export default function Button({ variant = 'default', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-[8px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        variantMap[variant],
        sizeMap[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
