'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { resetPassword, getCurrentUser } from '@/lib/auth/auth-client';

const NAV_ITEMS = [
  {
    href: '/home', label: '홈',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    href: '/mypage', label: '마이페이지', active: true,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  {
    href: '/settings', label: '설정',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
];

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro_waitlist: 'Pro 대기',
  pro: 'Pro',
  team: 'Team',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function MyPage() {
  const router = useRouter();
  const { user, loading, signOut, updateUser } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState('');

  const [avatarLoading, setAvatarLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [planLoading, setPlanLoading] = useState(false);
  const [totalManuals, setTotalManuals] = useState<number | null>(null);

  // 페이지 진입 시 최신 daily_manual_count + 전체 매뉴얼 수 로드
  useEffect(() => {
    if (!loading && user) {
      getCurrentUser().then(fresh => {
        if (fresh) updateUser({ daily_manual_count: fresh.daily_manual_count });
      }).catch(() => {});
      fetch('/api/tutorials')
        .then(r => r.ok ? r.json() : [])
        .then(list => setTotalManuals(Array.isArray(list) ? list.length : 0))
        .catch(() => setTotalManuals(0));
    }
  }, [loading, user, updateUser]);

  const isPro = user?.plan === 'pro' || user?.plan === 'team';

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setNameLoading(true);
    setNameError('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setNameError(err.error ?? '저장에 실패했습니다.');
      } else {
        setEditingName(false);
        window.location.reload();
      }
    } catch {
      setNameError('네트워크 오류가 발생했습니다.');
    } finally {
      setNameLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await fetch('/api/user/profile', { method: 'PUT', body: fd });
      if (res.ok) {
        const data = await res.json();
        updateUser({ avatar_url: data.avatar_url });
      } else {
        const err = await res.json();
        alert(err.error ?? '업로드에 실패했습니다.');
      }
    } catch {
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setAvatarLoading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' });
      if (res.ok) {
        await signOut();
        router.push('/landingpage');
      }
    } finally {
      setDeleteLoading(false);
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

  const isGoogle = user?.auth_provider === 'google';
  const displayAvatar = user?.avatar_url ?? null;

  return (
    <div className="mypage-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif", fontSize: '14px', color: '#111827', background: '#FAFAFA' }}>

      {/* Sidebar */}
      <aside className="mypage-sidebar" style={{ background: '#FAFAFA', borderRight: '1px solid #F3F4F6', padding: '16px 12px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 14px', textDecoration: 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32" style={{ flexShrink: 0 }}><circle cx="50" cy="50" r="50" fill="#3730a3"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text></svg>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>MIMIC</span>
        </Link>

        <div style={{ padding: '12px 10px 6px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', fontWeight: 500 }}>메뉴</div>

        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', fontSize: '13px', color: item.active ? '#3730a3' : '#4B5563', background: item.active ? '#e0e7ff' : 'transparent', fontWeight: item.active ? 500 : 400, textDecoration: 'none', marginBottom: '2px' }}>
            <span style={{ color: item.active ? '#3730a3' : '#9CA3AF' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <div style={{ marginTop: 'auto' }}>
          <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', fontSize: '13px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="mypage-main" style={{ padding: '36px 40px', maxWidth: '800px' }}>

        {/* 모바일 전용 헤더 */}
        <div className="mypage-mobile-header" style={{ display: 'none', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #F3F4F6' }}>
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

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px', color: '#111827' }}>마이페이지</h1>
            <p style={{ fontSize: '13.5px', color: '#6B7280', margin: 0 }}>계정 정보와 플랜을 관리하세요</p>
          </div>

          {/* 우측 상단: Google 사진 or 이니셜 */}
          {displayAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayAvatar} alt={user?.name ?? ''} width={36} height={36} style={{ borderRadius: '50%', display: 'block', flexShrink: 0 }} referrerPolicy="no-referrer" />
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? ''}
            </div>
          )}
        </div>

        {/* ── 프로필 카드 ── */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>프로필 정보</h2>
          </div>

          {/* 아바타 + 이름 */}
          <div style={{ padding: '22px 24px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #F3F4F6' }}>
            {/* 아바타 영역 */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {displayAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayAvatar} alt={user?.name ?? ''} width={52} height={52} style={{ borderRadius: '50%', display: 'block' }} referrerPolicy="no-referrer" />
              ) : (
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '20px', fontWeight: 600 }}>
                  {user?.name?.charAt(0)?.toUpperCase() ?? ''}
                </div>
              )}
              {/* 이메일 계정만 업로드 버튼 표시 */}
              {!isGoogle && (
                <label style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderRadius: '50%', background: avatarLoading ? '#9CA3AF' : '#3730a3', border: '2px solid white', display: 'grid', placeItems: 'center', cursor: avatarLoading ? 'default' : 'pointer' }}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={avatarLoading} />
                  {avatarLoading ? (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  )}
                </label>
              )}
            </div>

            <div style={{ flex: 1 }}>
              {editingName ? (
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameError(''); } }}
                      style={{ fontSize: '15px', fontWeight: 600, border: '1.5px solid #3730a3', borderRadius: '7px', padding: '5px 10px', outline: 'none', fontFamily: 'inherit', width: '180px' }}
                      autoFocus
                    />
                    <button onClick={handleSaveName} disabled={nameLoading} style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', border: 'none', cursor: 'pointer' }}>
                      {nameLoading ? '저장 중...' : '저장'}
                    </button>
                    <button onClick={() => { setEditingName(false); setNameError(''); }} style={{ padding: '6px 12px', borderRadius: '7px', fontSize: '12.5px', background: 'white', color: '#6B7280', border: '1px solid #E5E7EB', cursor: 'pointer' }}>
                      취소
                    </button>
                  </div>
                  {nameError && <p style={{ fontSize: '12px', color: '#EF4444', margin: 0 }}>{nameError}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{user?.name}</span>
                  {isGoogle ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', background: '#FEF3C7', color: '#D97706', fontSize: '11px', fontWeight: 500 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google 계정
                    </span>
                  ) : (
                    <button
                      onClick={() => { setNameInput(user?.name ?? ''); setEditingName(true); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', fontSize: '11.5px', color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      편집
                    </button>
                  )}
                </div>
              )}
              <p style={{ fontSize: '13.5px', color: '#4B5563', margin: 0 }}>{user?.email}</p>
            </div>
          </div>

          {/* 정보 그리드 */}
          <div className="mypage-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {[
              { label: '이메일', value: user?.email ?? '-' },
              { label: '가입일', value: user?.created_at ? formatDate(user.created_at) : '-' },
              { label: '로그인 방식', value: isGoogle ? 'Google 계정' : '이메일/비밀번호' },
              { label: '현재 플랜', value: PLAN_LABELS[user?.plan ?? 'free'] ?? user?.plan ?? '-' },
            ].map((row, i) => (
              <div key={row.label} style={{ padding: '14px 20px', borderTop: '1px solid #F3F4F6', borderRight: i % 2 === 0 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</div>
                <div style={{ fontSize: '14.5px', fontWeight: 500, color: '#111827' }}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 플랜 & 사용량 ── */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>플랜 & 사용량</h2>
          </div>

          {/* 현재 플랜 상태 */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{PLAN_LABELS[user?.plan ?? 'free']} 플랜</span>
                {isPro
                  ? <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white' }}>Pro</span>
                  : <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 500, background: '#F3F4F6', color: '#6B7280' }}>무료</span>
                }
              </div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>{isPro ? '매뉴얼 무제한 생성' : '매일 최대 3개 매뉴얼 생성'}</div>
            </div>
          </div>

          {/* Free 유저에게만 Pro 업그레이드 카드 표시 */}
          {!isPro && (
            <div style={{ margin: '20px 24px', borderRadius: '14px', border: '2px solid #3730a3', overflow: 'hidden', boxShadow: '0 8px 24px rgba(55,48,163,0.10)' }}>
              <div style={{ background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pro 플랜으로 업그레이드</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '999px' }}>가장 인기</span>
              </div>
              <div style={{ background: 'white', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.03em', color: '#0D0D14', lineHeight: 1 }}>₩9,900</span>
                  <span style={{ fontSize: '13px', color: '#9CA3AF', paddingBottom: '4px' }}>/ 월</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['매뉴얼 무제한 생성', 'AI 다듬기 무제한', 'HTML·MD 내보내기', '비공개 + 비밀번호 보호', '5GB 저장 공간'].map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={planLoading}
                  onClick={async () => {
                    setPlanLoading(true);
                    try {
                      alert('결제 기능은 준비 중입니다. 곧 출시될 예정이에요!');
                    } finally {
                      setPlanLoading(false);
                    }
                  }}
                  style={{ display: 'block', width: '100%', padding: '13px 0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textAlign: 'center', cursor: 'pointer', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(55,48,163,0.28)', fontFamily: 'inherit' }}
                >
                  Pro 구독하기
                </button>
              </div>
            </div>
          )}

          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>전체 매뉴얼 등록 수</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#3730a3' }}>{totalManuals == null ? '…' : `${totalManuals}개`}</span>
            </div>
          </div>
        </div>

        {/* ── 계정 보안 ── */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>계정 보안</h2>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', marginBottom: '2px' }}>비밀번호 변경</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                {isGoogle ? 'Google 계정으로 로그인 중입니다' : '이메일로 비밀번호 재설정 링크를 받습니다'}
              </div>
            </div>
            {!isGoogle && (
              <button
                onClick={async () => {
                  if (!user?.email) return;
                  try {
                    await resetPassword(user.email);
                    alert('비밀번호 재설정 이메일을 발송했습니다.');
                  } catch {
                    alert('이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
                  }
                }}
                style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, color: '#3730a3', border: '1.5px solid #3730a3', cursor: 'pointer', flexShrink: 0, background: 'white' }}
              >
                재설정 이메일 받기
              </button>
            )}
          </div>
        </div>

        {/* ── 위험 구역: 회원 탈퇴 ── */}
        <div style={{ background: 'white', border: '1.5px solid #FEE2E2', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #FEE2E2', background: '#FFF5F5' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#EF4444', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>위험 구역</h2>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {!deleteConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', marginBottom: '2px' }}>회원 탈퇴</div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF' }}>모든 매뉴얼과 데이터가 영구 삭제되며 복구할 수 없습니다</div>
                </div>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500, background: 'white', color: '#EF4444', border: '1.5px solid #FCA5A5', cursor: 'pointer', flexShrink: 0 }}
                >
                  회원 탈퇴
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '8px', background: '#FFF5F5', border: '1px solid #FEE2E2', marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div style={{ fontSize: '12.5px', color: '#DC2626', lineHeight: 1.5 }}>
                    계속 진행하면 모든 매뉴얼, 스텝, 녹음 데이터가 <strong>영구 삭제</strong>됩니다. 이 작업은 되돌릴 수 없습니다.
                  </div>
                </div>
                <div style={{ fontSize: '12.5px', color: '#6B7280', marginBottom: '8px' }}>
                  확인을 위해 아래에 <strong style={{ color: '#111827' }}>DELETE</strong> 를 입력해주세요
                </div>
                <input
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  style={{ display: 'block', width: '100%', padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', marginBottom: '12px', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== 'DELETE' || deleteLoading}
                    style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: deleteInput === 'DELETE' ? '#EF4444' : '#F3F4F6', color: deleteInput === 'DELETE' ? 'white' : '#9CA3AF', border: 'none', cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
                  >
                    {deleteLoading ? '삭제 중...' : '영구 삭제'}
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }}
                    style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'white', color: '#6B7280', border: '1px solid #E5E7EB', cursor: 'pointer' }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '12.5px', color: '#9CA3AF', textAlign: 'center', marginTop: '28px', paddingBottom: '40px' }}>
          <Link href="/legal/terms" style={{ color: '#6B7280', textDecoration: 'underline', textUnderlineOffset: '2px' }}>이용약관</Link>
          {' · '}
          <Link href="/legal/privacy" style={{ color: '#6B7280', textDecoration: 'underline', textUnderlineOffset: '2px' }}>개인정보 처리방침</Link>
        </div>
      </main>
    </div>
  );
}
