interface WordmarkProps {
  /** font-size in px */
  size?: number;
  /** "학원" 글자 색 — 어두운 배경은 #e5e7eb(기본), 밝은 배경엔 진한 색 지정 */
  hakwonColor?: string;
  className?: string;
}

export default function Wordmark({ size = 22, hakwonColor = '#e5e7eb', className }: WordmarkProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'Pretendard, sans-serif',
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '-0.045em',
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
      }}
    >
      <span style={{ color: hakwonColor }}>학원</span>
      <span style={{ color: '#34d399' }}>로그</span>
    </span>
  );
}
