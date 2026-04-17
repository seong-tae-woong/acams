import clsx from 'clsx';

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base' };

export default function Avatar({ name, color = '#4fc3a1', size = 'md', className }: AvatarProps) {
  const initial = name.charAt(0);
  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
        sizeMap[size],
        className,
      )}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {initial}
    </div>
  );
}
