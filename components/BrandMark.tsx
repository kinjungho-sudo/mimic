// eslint-disable-next-line @next/next/no-img-element
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/mimic-logo.png"
      alt="MIMIC"
      width={size}
      height={size}
      style={{ objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
