'use client';

type ParroMascotProps = {
  size?: number;
  className?: string;
};

/**
 * Parro의 공용 AI 가이드 마스코트.
 * 외부 이미지에 의존하지 않는 오리지널 SVG라 랜딩·학습 가이드에서 동일하게 사용한다.
 */
export function ParroMascot({ size = 48, className }: ParroMascotProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      role="img"
      aria-label="Parro AI 가이드 마스코트"
    >
      <ellipse cx="36" cy="65" rx="17" ry="3.5" fill="rgba(0,63,57,.14)" />
      <path d="M24 42c1.4-8.9 7.2-13.2 12-13.2S46.6 33.1 48 42l1.2 10.7C50.4 62.3 44 68 36 68s-14.4-5.7-13.2-15.3L24 42Z" fill="#F9FCFD" stroke="#C5D7DA" strokeWidth="1.5" />
      <path d="M22.7 44.5c-5.7 1.2-8.5 6.1-7.7 11 .5 3 2.5 4.3 5 3.4 4.7-1.7 7.4-6.2 6.8-10.3-.4-2.7-1.7-4.6-4.1-4.1Z" fill="#EFF5F6" stroke="#C5D7DA" strokeWidth="1.35" />
      <path d="M49.3 44.5c5.7 1.2 8.5 6.1 7.7 11-.5 3-2.5 4.3-5 3.4-4.7-1.7-7.4-6.2-6.8-10.3.4-2.7 1.7-4.6 4.1-4.1Z" fill="#EFF5F6" stroke="#C5D7DA" strokeWidth="1.35" />
      <rect x="32.5" y="31" width="7" height="5" rx="2.5" fill="#17272A" />
      <ellipse cx="36" cy="22.5" rx="24" ry="19.5" fill="#FAFDFE" stroke="#C5D7DA" strokeWidth="1.6" />
      <ellipse cx="11.8" cy="23" rx="4.5" ry="7.8" fill="#DDECEF" stroke="#B8D0D5" strokeWidth="1.2" />
      <ellipse cx="60.2" cy="23" rx="4.5" ry="7.8" fill="#DDECEF" stroke="#B8D0D5" strokeWidth="1.2" />
      <rect x="18" y="10.5" width="36" height="25" rx="12.5" fill="#14272A" />
      <path d="M24.5 23c.2-3.3 2-5.2 4.5-5.2s4.3 1.9 4.5 5.2" stroke="#69ECF2" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M38.5 23c.2-3.3 2-5.2 4.5-5.2s4.3 1.9 4.5 5.2" stroke="#69ECF2" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M29.5 27.8c3.8 3.6 9.2 3.6 13 0" stroke="#7EF1D1" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M31 46c2.7 1.5 7.3 1.5 10 0" stroke="#00A99A" strokeWidth="2" strokeLinecap="round" opacity=".72" />
      <circle cx="53" cy="12" r="3" fill="#8DD63F" stroke="#FAFDFE" strokeWidth="1.5" />
    </svg>
  );
}
