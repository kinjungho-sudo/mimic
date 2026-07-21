'use client';

/* eslint-disable @next/next/no-img-element -- avatar URLs come from user-configured storage */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, Users, Zap, Settings,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: '홈', href: '/home' },
  { icon: BookOpen, label: '매뉴얼', href: '/manual' },
  { icon: Users, label: '팀', href: '#' },
  { icon: Zap, label: '자동화', href: '#' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <aside style={{
      width: '60px', flexShrink: 0,
      background: '#111827',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: '12px', paddingBottom: '16px',
      gap: '4px',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px',
        background: 'linear-gradient(135deg, #009B8E 0%, #12B886 100%)',
        display: 'grid', placeItems: 'center',
        marginBottom: '16px', flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', alignItems: 'center' }}>
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = href !== '#' && pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              title={label}
              style={{
                width: '42px', height: '42px', borderRadius: '10px',
                display: 'grid', placeItems: 'center',
                color: active ? 'white' : 'rgba(255,255,255,0.4)',
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; } }}
            >
              <Icon size={18} />
            </Link>
          );
        })}
      </div>

      {/* Bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
        <Link href="/settings" title="설정" style={{ width: '42px', height: '42px', borderRadius: '10px', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}>
          <Settings size={17} />
        </Link>
        {/* User avatar → mypage */}
        <Link
          href="/mypage"
          title={user?.name ?? user?.email ?? '마이페이지'}
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: user?.avatar_url
              ? 'transparent'
              : 'linear-gradient(135deg, #009B8E 0%, #12B886 100%)',
            border: '2px solid rgba(255,255,255,0.15)',
            display: 'grid', placeItems: 'center',
            overflow: 'hidden', flexShrink: 0,
            textDecoration: 'none',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', lineHeight: 1 }}>{initials}</span>
          )}
        </Link>
      </div>
    </aside>
  );
}
