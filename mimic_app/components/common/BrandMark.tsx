import { BRAND_COLORS } from '@/lib/brand';

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r="50" fill={BRAND_COLORS.primary} />
      <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">P</text>
    </svg>
  );
}
