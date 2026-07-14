export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width={size} height={size} style={{ flexShrink: 0 }}>
      <path d="M69 55C50 40 28 34 11 14c5 25 22 43 53 51l5-10Z" fill="#00A99D" />
      <path d="M67 63C43 53 23 51 7 38c8 23 27 34 57 33l3-8Z" fill="#008E86" />
      <path d="M69 69C46 65 29 68 15 62c12 18 31 20 54 14v-7Z" fill="#8DD63F" />
      <circle cx="72" cy="70" r="14" fill="#fff" stroke="#8DD63F" strokeWidth="6" />
      <circle cx="72" cy="70" r="7" fill="none" stroke="#00A99D" strokeWidth="3" />
      <path d="m69 64 37 15-16 6-8 22-13-43Z" fill="#102033" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}
