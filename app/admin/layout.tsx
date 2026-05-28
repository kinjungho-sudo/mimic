'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    label: '대시보드',
    href: '/admin',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    label: '유저 관리',
    href: '/admin/users',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    label: '튜토리얼 관리',
    href: '/admin/tutorials',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  {
    label: 'Pro 대기자',
    href: '/admin/pro-signups',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    label: '설문 응답',
    href: '/admin/surveys',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: "'Pretendard', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif", fontSize: '13.5px', color: '#111827' }}>
      <aside style={{ background: '#0F172A', borderRight: '1px solid #1E293B', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 16px', fontSize: '13px', fontWeight: 500, color: 'white' }}>
          <span style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', display: 'grid', placeItems: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
              <rect x="3.2" y="5.2" width="11" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/>
              <rect x="3.2" y="10.8" width="14" height="2.4" rx="1.2" fill="white"/>
              <rect x="3.2" y="16.4" width="8" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/>
              <circle cx="18.7" cy="17.6" r="3.6" fill="white"/>
              <path d="M17.6 16.1 L20.1 17.6 L17.6 19.1 Z" fill="#4F46E5"/>
            </svg>
          </span>
          <span>MIMIC <span style={{ color: '#64748B', fontWeight: 400 }}>Admin</span></span>
        </div>

        <div style={{ padding: '10px 10px 6px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontWeight: 500 }}>메뉴</div>

        {navItems.map(item => {
          const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', fontSize: '13px', color: isActive ? 'white' : '#94A3B8', background: isActive ? 'rgba(79,70,229,0.25)' : 'transparent', fontWeight: isActive ? 500 : 400, textDecoration: 'none', transition: 'background 0.15s, color 0.15s' }}>
              {item.icon}
              {item.label}
            </Link>
          );
        })}

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #1E293B' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', color: '#64748B', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            일반 대시보드로
          </Link>
        </div>
      </aside>

      <main style={{ background: '#F8FAFC', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
