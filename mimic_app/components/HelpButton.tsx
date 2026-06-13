'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function HelpButton() {
  const pathname = usePathname();
  if (
    pathname === '/' ||
    pathname === '/help' ||
    pathname.startsWith('/play/') ||
    pathname.startsWith('/embed/')
  ) return null;

  return (
    <Link
      href="/help"
      title="도움말"
      style={{
        position: 'fixed',
        top: '14px',
        right: '24px',
        zIndex: 9000,
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: '#3730a3',
        color: 'white',
        display: 'grid',
        placeItems: 'center',
        textDecoration: 'none',
        boxShadow: '0 4px 14px rgba(55,48,163,0.35)',
        fontSize: '17px',
        fontWeight: 700,
        lineHeight: 1,
        fontFamily: 'Georgia, serif',
        transition: 'background 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = '#4338ca';
        el.style.transform = 'scale(1.08)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = '#3730a3';
        el.style.transform = 'scale(1)';
      }}
    >
      ?
    </Link>
  );
}
