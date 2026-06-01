interface BrandMarkProps {
  /** 한 변 px (정사각) */
  size?: number;
  /** gradient: teal 그라데이션 / solid: 단색 teal / auto: 28px 미만은 solid */
  variant?: 'gradient' | 'solid' | 'auto';
  className?: string;
  /** 접근성 라벨. 장식용이면 '' 전달 */
  title?: string;
}

/**
 * 학원로그 브랜드 마크(HL). 규격은 DESIGN.md "브랜드 마크" 참조.
 * 기하학적 SVG라 폰트에 의존하지 않으며 모든 사이즈에서 선명합니다.
 */
export default function BrandMark({
  size = 32,
  variant = 'auto',
  className,
  title = '학원로그',
}: BrandMarkProps) {
  const solid = variant === 'solid' || (variant === 'auto' && size < 28);
  const fill = solid ? '#12B886' : 'url(#bm-grad)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {!solid && (
        <defs>
          <linearGradient id="bm-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#12B886" />
            <stop offset="1" stopColor="#4FC3A1" />
          </linearGradient>
        </defs>
      )}
      <rect width="100" height="100" rx="24" fill={fill} />
      <g fill="#fff">
        <rect x="21" y="28" width="12" height="44" rx="2" />
        <rect x="39" y="28" width="12" height="44" rx="2" />
        <rect x="21" y="44" width="30" height="12" rx="2" />
        <rect x="57" y="28" width="12" height="44" rx="2" />
        <rect x="57" y="60" width="22" height="12" rx="2" />
      </g>
    </svg>
  );
}
