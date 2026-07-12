export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r="50" fill="#3730a3"/>
      <text x="50" y="65" textAnchor="middle" fontFamily="Pretendard, sans-serif" fontSize="44" fontWeight="800" fill="white">포</text>
    </svg>
  );
}
