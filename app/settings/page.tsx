'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: '홈', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { href: '/mypage', label: '마이페이지', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { href: '/settings', label: '설정', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, active: true },
];

function ToggleRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827' }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{ width: '40px', height: '22px', borderRadius: '11px', background: value ? '#4F46E5' : '#E5E7EB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: '3px', left: value ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  );
}


export default function SettingsPage() {
  const { user, loading, signOut, updateUser } = useAuth();
  const router = useRouter();

  const [marketing, setMarketing] = useState<boolean | null>(null);
  const currentMarketing = marketing !== null ? marketing : (user?.agreements?.marketing ?? false);

  const handleToggle = async (value: boolean) => {
    setMarketing(value);
    const res = await fetch('/api/user/agreements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketing: value }),
    });
    if (res.ok) {
      const data = await res.json();
      updateUser({ agreements: data.agreements });
    } else {
      setMarketing(!value);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(79,70,229,0.15)', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width: '220px', flexShrink: 0, background: 'white', borderRight: '1px solid #F3F4F6', padding: '0 12px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '20px 8px 16px', borderBottom: '1px solid #F3F4F6', marginBottom: '8px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#111827', textDecoration: 'none' }}>
            <span style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'grid', placeItems: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="3.2" y="5.2" width="11" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/><rect x="3.2" y="10.8" width="14" height="2.4" rx="1.2" fill="white"/><rect x="3.2" y="16.4" width="8" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/><circle cx="18.7" cy="17.6" r="3.6" fill="white"/><path d="M17.6 16.1 L20.1 17.6 L17.6 19.1 Z" fill="#4F46E5"/></svg>
            </span>
            MIMIC
          </Link>
        </div>
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', fontSize: '13.5px', fontWeight: item.active ? 500 : 400, color: item.active ? '#4F46E5' : '#4B5563', background: item.active ? '#EEF2FF' : 'transparent', textDecoration: 'none', marginBottom: '2px' }}>
              <span style={{ color: item.active ? '#4F46E5' : '#9CA3AF' }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: '720px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px', color: '#111827' }}>설정</h1>
          <p style={{ fontSize: '13.5px', color: '#6B7280', margin: 0 }}>확장 프로그램 연동 및 계정을 관리하세요</p>
        </div>

        <Section title="알림">
          <ToggleRow
            label="이메일 수신 동의"
            description="서비스 소식, 새 기능 업데이트, 주요 활동 알림을 이메일로 받습니다"
            value={currentMarketing}
            onChange={handleToggle}
          />
        </Section>

        <Section title="Chrome 확장 프로그램">
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827' }}>MIMIC Recorder</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>재설치하거나 연결이 끊겼을 때 다시 연결합니다 (30일 자동 유지)</div>
            </div>
            <Link href="/extension-link" style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', textDecoration: 'none', boxShadow: '0 2px 8px rgba(79,70,229,0.25)' }}>
              연결하기
            </Link>
          </div>
        </Section>

        <Section title="계정">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
            <Link href="/mypage" style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>프로필 및 구독 관리</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          </div>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
            <a href="mailto:hello@mimicflow.com" style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>고객 지원 문의</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
          <div style={{ padding: '14px 20px' }}>
            <button
              onClick={handleSignOut}
              style={{ fontSize: '13.5px', fontWeight: 500, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              로그아웃
            </button>
          </div>
        </Section>

        <div style={{ fontSize: '12px', color: '#D1D5DB', textAlign: 'center', marginTop: '12px' }}>
          <Link href="/legal/terms" style={{ color: '#D1D5DB', textDecoration: 'none' }}>이용약관</Link>
          {' · '}
          <Link href="/legal/privacy" style={{ color: '#D1D5DB', textDecoration: 'none' }}>개인정보 처리방침</Link>
          {' · '}
          hello@mimicflow.com
        </div>
      </main>
    </div>
  );
}
