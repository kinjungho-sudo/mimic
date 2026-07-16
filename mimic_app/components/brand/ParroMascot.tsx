'use client';

type ParroMascotProps = {
  size?: number;
  className?: string;
};

/**
 * Parro의 공용 AI 가이드 마스코트.
 * Wing Pointer의 날개·포인터 모티프를 이어받은 친근한 AI 앵무새 아바타.
 * 외부 이미지에 의존하지 않는 오리지널 SVG라 랜딩·학습·도움말에서 동일하게 사용한다.
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
      aria-label="Parro AI 앵무새 가이드"
    >
      <ellipse cx="35" cy="65" rx="19" ry="3" fill="rgba(16,32,51,.14)" />
      <path d="M28 56 21 67l12-6 4-8Z" fill="#102033" />
      <path d="M37 57 34 69l10-8 1-8Z" fill="#007C72" />
      <path d="M18 35c0-14 8.7-25 22-25 11.5 0 20 8.3 20 19.5 0 5.5-2.1 10-6.1 13.3C51 45.2 49 49 48.3 54.5 47.4 62.2 42 66 34.8 66 24.7 66 18 58.4 18 47.8Z" fill="#009B8E" stroke="#006E66" strokeWidth="1.5" />
      <path d="M19.5 39c-6.1 1.6-9.2 6.7-8.2 11.8.7 3.8 3.3 5.3 6.4 3.6 5.3-2.9 8.3-8.6 7-13-.7-2.5-2.4-3.1-5.2-2.4Z" fill="#12B886" stroke="#007C72" strokeWidth="1.3" />
      <path d="M30 39c5.2-5.9 12.8-7.1 19.3-2.7-1.3 10.8-7.5 18.2-18.1 22.1-3.8-6.1-4.2-13-.9-19.4Z" fill="#8DD63F" stroke="#63A72D" strokeWidth="1.4" />
      <path d="m34 42 11.5 5.5-8.3 2.2-3.2 8.1Z" fill="#F9FCFD" opacity=".96" />
      <path d="M31 28c0-7.8 6.1-14.2 13.7-14.2 8 0 14.3 5.8 14.3 13.5 0 7.9-6.3 14.2-14.1 14.2C37.3 41.5 31 35.6 31 28Z" fill="#E8FFF7" />
      <path d="M53.5 26.2 67 31.5l-12.6 5.1c1.1-3.2.8-7-.9-10.4Z" fill="#FF7A3D" stroke="#D95822" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="47.5" cy="25.5" r="4.4" fill="#102033" />
      <circle cx="49" cy="24" r="1.35" fill="white" />
      <path d="M37.5 15.5c3.2-5.6 8.1-8.8 14.1-9.4-1.8 3-2.1 6.1-.9 9.2" fill="#12B886" stroke="#007C72" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="27" cy="48" r="3" fill="#E8FFF7" opacity=".55" />
    </svg>
  );
}
