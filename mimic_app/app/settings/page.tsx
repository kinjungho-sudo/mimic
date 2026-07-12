'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { BrandMark } from '@/components/common/BrandMark';
import { BRAND_COLORS, BRAND_COPY, BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.guide})`;
const BRAND_RING = 'rgba(0,155,142,0.25)';
const BRAND_RING_SOFT = 'rgba(0,155,142,0.15)';

const NAV_ITEMS = [
  { href: '/home', label: '홈', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
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
        style={{ width: '40px', height: '22px', borderRadius: '11px', background: value ? BRAND_COLORS.primary : '#E5E7EB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
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
  const { user, loading, updateUser } = useAuth();

  const [marketing, setMarketing] = useState<boolean | null>(null);
  const [affiliation, setAffiliation] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState('#4F46E5');
  const [footerText, setFooterText] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const currentMarketing = marketing !== null ? marketing : (user?.agreements?.marketing ?? false);

  useEffect(() => {
    if (user?.name) setDisplayName(user.name);
  }, [user?.name]);

  useEffect(() => {
    fetch('/api/user/branding')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        setAffiliation(data.company_name ?? '');
        setLogoUrl(data.logo_url ?? null);
        setBrandColor(data.primary_color ?? '#4F46E5');
        setFooterText(data.footer_text ?? null);
      })
      .catch(() => {});
  }, []);

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch('/api/user/branding', {
        method: 'PUT',
        body: formData,
      });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      setLogoUrl(data.logo_url ?? null);
      setProfileSaved(false);
    } catch {
      alert('회사 로고를 업로드하지 못했습니다.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    setLogoUploading(true);
    try {
      const res = await fetch('/api/user/branding', { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setLogoUrl(null);
      setProfileSaved(false);
    } catch {
      alert('회사 로고를 삭제하지 못했습니다.');
    } finally {
      setLogoUploading(false);
    }
  };

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

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const [brandingRes, profileRes] = await Promise.all([
        fetch('/api/user/branding', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primary_color: brandColor,
            company_name: affiliation.trim() || null,
            footer_text: footerText,
          }),
        }),
        fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: displayName.trim() }),
        }),
      ]);
      if (!brandingRes.ok || !profileRes.ok) throw new Error('save failed');
      updateUser({ name: displayName.trim() });
      setProfileSaved(true);
    } catch {
      alert('소속과 성함을 저장하지 못했습니다.');
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `3px solid ${BRAND_RING_SOFT}`, borderTopColor: BRAND_COLORS.primary, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="settings-layout" style={{ display: 'flex', minHeight: '100vh', background: '#FAFAFA', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>

      {/* Sidebar */}
      <aside className="settings-sidebar" style={{ width: '220px', flexShrink: 0, background: 'white', borderRight: '1px solid #F3F4F6', padding: '0 12px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '20px 8px 16px', borderBottom: '1px solid #F3F4F6', marginBottom: '8px' }}>
          <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <BrandMark />
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>{BRAND_NAME}</span>
          </Link>
        </div>
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', fontSize: '13.5px', fontWeight: item.active ? 500 : 400, color: item.active ? BRAND_COLORS.primary : '#4B5563', background: item.active ? BRAND_COLORS.guideSoft : 'transparent', textDecoration: 'none', marginBottom: '2px' }}>
              <span style={{ color: item.active ? BRAND_COLORS.primary : '#9CA3AF' }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="settings-main" style={{ flex: 1, padding: '32px 40px', maxWidth: '720px' }}>

        {/* 모바일 전용 헤더 */}
        <div className="settings-mobile-header" style={{ display: 'none', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #F3F4F6' }}>
          <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <BrandMark size={28} />
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>{BRAND_NAME}</span>
          </Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '7px', fontSize: '12px', color: item.active ? BRAND_COLORS.primary : '#6B7280', background: item.active ? BRAND_COLORS.guideSoft : 'transparent', fontWeight: item.active ? 600 : 400, textDecoration: 'none' }}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

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

        <Section title="내보내기 표기">
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#374151' }}>회사 로고</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '120px', height: '48px', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="회사 로고" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>로고 없음</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <label style={{ height: '34px', padding: '0 12px', borderRadius: '8px', border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontSize: '12.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', cursor: logoUploading ? 'not-allowed' : 'pointer', opacity: logoUploading ? 0.55 : 1 }}>
                      {logoUploading ? '처리 중…' : '로고 업로드'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        disabled={logoUploading}
                        onChange={e => {
                          const file = e.target.files?.[0] ?? null;
                          void handleLogoUpload(file);
                          e.currentTarget.value = '';
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleLogoDelete}
                        disabled={logoUploading}
                        style={{ height: '34px', padding: '0 12px', borderRadius: '8px', border: '1px solid #FCA5A5', background: 'white', color: '#B91C1C', fontSize: '12.5px', fontWeight: 600, cursor: logoUploading ? 'not-allowed' : 'pointer', opacity: logoUploading ? 0.55 : 1 }}
                      >
                        삭제
                      </button>
                    )}
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>PNG/JPG · PDF/Word/슬라이드 표지에 사용됩니다</span>
                  </div>
                </div>
              </div>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#374151' }}>소속</span>
                <input
                  value={affiliation}
                  onChange={e => { setAffiliation(e.target.value); setProfileSaved(false); }}
                  placeholder="예: Parro"
                  maxLength={50}
                  style={{ height: '38px', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '0 11px', fontSize: '13px', outline: 'none' }}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#374151' }}>성함</span>
                <input
                  value={displayName}
                  onChange={e => { setDisplayName(e.target.value); setProfileSaved(false); }}
                  placeholder="표지 담당자명"
                  maxLength={50}
                  style={{ height: '38px', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '0 11px', fontSize: '13px', outline: 'none' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
              <button
                onClick={handleProfileSave}
                disabled={profileSaving || !displayName.trim()}
                style={{ height: '34px', padding: '0 14px', borderRadius: '8px', border: 'none', background: '#3730a3', color: 'white', fontSize: '12.5px', fontWeight: 600, cursor: profileSaving || !displayName.trim() ? 'not-allowed' : 'pointer', opacity: profileSaving || !displayName.trim() ? 0.55 : 1 }}
              >
                {profileSaving ? '저장 중…' : '저장'}
              </button>
              <span style={{ fontSize: '12px', color: profileSaved ? '#059669' : '#9CA3AF' }}>
                {profileSaved ? '저장되었습니다' : '문서/슬라이드 표지의 회사명·담당자에 사용됩니다'}
              </span>
            </div>
          </div>
        </Section>

        <Section title="Chrome 확장 프로그램">
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827' }}>{BRAND_COPY.extensionDisplayName}</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>재설치하거나 연결이 끊겼을 때 다시 연결합니다 (30일 자동 유지)</div>
            </div>
            <Link href="/extension-link" style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, background: BRAND_GRADIENT, color: 'white', textDecoration: 'none', boxShadow: `0 2px 8px ${BRAND_RING}` }}>
              연결하기
            </Link>
          </div>
        </Section>

        <Section title="계정">
          <div style={{ padding: '14px 20px' }}>
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>고객 지원 문의</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
        </Section>

        <div style={{ fontSize: '12.5px', color: '#9CA3AF', textAlign: 'center', marginTop: '12px' }}>
          <Link href="/legal/terms" style={{ color: '#6B7280', textDecoration: 'underline', textUnderlineOffset: '2px' }}>이용약관</Link>
          {' · '}
          <Link href="/legal/privacy" style={{ color: '#6B7280', textDecoration: 'underline', textUnderlineOffset: '2px' }}>개인정보 처리방침</Link>
          {' · '}
          {BRAND_SUPPORT_EMAIL}
        </div>
      </main>
    </div>
  );
}
