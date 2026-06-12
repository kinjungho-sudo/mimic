'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

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
        style={{ width: '40px', height: '22px', borderRadius: '11px', background: value ? '#3730a3' : '#E5E7EB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: '3px', left: value ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB',
  fontSize: '13.5px', color: '#111827', outline: 'none', boxSizing: 'border-box',
};

function BrandingSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#4F46E5');
  const [companyName, setCompanyName] = useState('');
  const [footerText, setFooterText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/branding');
        if (res.ok) {
          const data = await res.json();
          setLogoUrl(data.logo_url ?? null);
          setPrimaryColor(data.primary_color ?? '#4F46E5');
          setCompanyName(data.company_name ?? '');
          setFooterText(data.footer_text ?? '');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await fetch('/api/user/branding', { method: 'PUT', body: fd });
      const data = await res.json();
      if (res.ok) setLogoUrl(data.logo_url);
      else setError(data.error ?? '로고 업로드에 실패했습니다.');
    } catch {
      setError('로고 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    setError(null);
    const res = await fetch('/api/user/branding', { method: 'DELETE' });
    if (res.ok) setLogoUrl(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/user/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_color: primaryColor,
          company_name: companyName || null,
          footer_text: footerText || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? '저장에 실패했습니다.');
      }
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', fontSize: '13px', color: '#9CA3AF' }}>불러오는 중...</div>;
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 로고 */}
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', marginBottom: '6px' }}>회사 로고</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '120px', height: '48px', borderRadius: '8px', border: '1px dashed #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="회사 로고" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: '11px', color: '#9CA3AF' }}>로고 없음</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, border: '1px solid #E5E7EB', background: 'white', color: '#374151', cursor: 'pointer' }}
          >
            {uploading ? '업로드 중...' : '업로드'}
          </button>
          {logoUrl && (
            <button
              onClick={handleLogoRemove}
              style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer' }}
            >
              제거
            </button>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }}>PNG/JPG, 2MB 이하 · PPTX 표지에 표시됩니다</div>
      </div>

      {/* 메인 컬러 */}
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', marginBottom: '6px' }}>메인 컬러</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="color"
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            style={{ width: '36px', height: '36px', padding: 0, border: '1px solid #E5E7EB', borderRadius: '8px', cursor: 'pointer', background: 'white' }}
          />
          <input
            type="text"
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            maxLength={7}
            style={{ ...inputStyle, width: '110px', fontFamily: 'monospace' }}
          />
        </div>
        <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }}>표지 배경과 강조색으로 사용됩니다</div>
      </div>

      {/* 회사명 */}
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', marginBottom: '6px' }}>회사명</div>
        <input
          type="text"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="예: 주식회사 미믹"
          maxLength={50}
          style={{ ...inputStyle, maxWidth: '320px' }}
        />
      </div>

      {/* 푸터 문구 */}
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', marginBottom: '6px' }}>푸터 문구</div>
        <input
          type="text"
          value={footerText}
          onChange={e => setFooterText(e.target.value)}
          placeholder="예: 사내 교육용 — 무단 배포 금지"
          maxLength={100}
          style={{ ...inputStyle, maxWidth: '420px' }}
        />
        <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }}>모든 슬라이드 하단에 작게 표시됩니다</div>
      </div>

      {/* 저장 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', cursor: 'pointer', boxShadow: '0 2px 8px rgba(55,48,163,0.25)' }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {saved && <span style={{ fontSize: '12.5px', color: '#059669' }}>저장되었습니다</span>}
        {error && <span style={{ fontSize: '12.5px', color: '#DC2626' }}>{error}</span>}
      </div>
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

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(55,48,163,0.15)', borderTopColor: '#3730a3', animation: 'spin 0.8s linear infinite' }} />
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32" style={{ flexShrink: 0 }}><circle cx="50" cy="50" r="50" fill="#3730a3"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text></svg>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>MIMIC</span>
          </Link>
        </div>
        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', fontSize: '13.5px', fontWeight: item.active ? 500 : 400, color: item.active ? '#3730a3' : '#4B5563', background: item.active ? '#e0e7ff' : 'transparent', textDecoration: 'none', marginBottom: '2px' }}>
              <span style={{ color: item.active ? '#3730a3' : '#9CA3AF' }}>{item.icon}</span>
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28"><circle cx="50" cy="50" r="50" fill="#3730a3"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text></svg>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>MIMIC</span>
          </Link>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '7px', fontSize: '12px', color: item.active ? '#3730a3' : '#6B7280', background: item.active ? '#e0e7ff' : 'transparent', fontWeight: item.active ? 600 : 400, textDecoration: 'none' }}>
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

        <Section title="브랜딩 — PPTX 내보내기">
          <BrandingSection />
        </Section>

        <Section title="Chrome 확장 프로그램">
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827' }}>MIMIC Recorder</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>재설치하거나 연결이 끊겼을 때 다시 연결합니다 (30일 자동 유지)</div>
            </div>
            <Link href="/extension-link" style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', textDecoration: 'none', boxShadow: '0 2px 8px rgba(55,48,163,0.25)' }}>
              연결하기
            </Link>
          </div>
        </Section>

        <Section title="계정">
          <div style={{ padding: '14px 20px' }}>
            <a href="mailto:hello@mimicflow.com" style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>고객 지원 문의</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
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
