'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithGoogle, signInWithEmail } from '@/lib/auth-client';

const BrandMark = () => (
  <span style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,0.20)', border: '1px solid rgba(255,255,255,0.30)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <rect x="3.2" y="5.2" width="11" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/>
      <rect x="3.2" y="10.8" width="14" height="2.4" rx="1.2" fill="white"/>
      <rect x="3.2" y="16.4" width="8" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/>
      <circle cx="18.7" cy="17.6" r="3.6" fill="white"/>
      <path d="M17.6 16.1 L20.1 17.6 L17.6 19.1 Z" fill="#4F46E5"/>
    </svg>
  </span>
);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/home';
  const signupSuccess = searchParams.get('signup') === 'success';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle(next !== '/home' ? next : undefined);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email, password);
      router.push(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '이메일 또는 비밀번호를 확인해주세요.');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44% 56%', minHeight: '100vh', fontFamily: "'Pretendard', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif" }}>

      {/* Left brand panel */}
      <aside style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', padding: '56px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(600px 320px at 100% 0%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(500px 280px at 0% 100%, rgba(0,0,0,0.18), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Link href="/landingpage" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 500, color: 'white', textDecoration: 'none' }}>
            <BrandMark /> MIMIC
          </Link>

          <div style={{ marginTop: 'auto', paddingBottom: '8px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.25, margin: '0 0 14px' }}>다시 오신 걸 환영해요</h1>
            <p style={{ fontSize: '14.5px', opacity: 0.85, maxWidth: '420px', lineHeight: 1.6, margin: '0 0 36px' }}>매뉴얼은 만들어두고, 잊고 있던 사이에도 사람들은 따라하고 있습니다.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, title: '30초 만에 매뉴얼 제작', sub: 'Chrome 확장으로 평소처럼 일하면 끝.' },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>, title: '3가지 형태로 자동 변환', sub: '가이드 문서 · 인터랙티브 튜토리얼 · 영상.' },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, title: '링크 한 줄로 공유', sub: '슬랙·카톡·이메일 어디에든 붙여넣기.' },
              ].map(pt => (
                <div key={pt.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13.5px' }}>
                  <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.20)', display: 'grid', placeItems: 'center' }}>{pt.icon}</span>
                  <div>
                    <strong style={{ display: 'block', fontWeight: 500, marginBottom: '2px' }}>{pt.title}</strong>
                    <span style={{ opacity: 0.78 }}>{pt.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '36px', fontSize: '11.5px', opacity: 0.6 }}>© 2026 코마인드웍스</div>
        </div>
      </aside>

      {/* Right form panel */}
      <section style={{ display: 'flex', flexDirection: 'column', padding: '36px 64px', background: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#6B7280' }}>
          계정이 없으신가요?
          <Link href="/auth/signup" style={{ color: '#4F46E5', fontWeight: 500, marginLeft: '4px', textDecoration: 'none' }}>회원가입</Link>
        </div>

        <div style={{ width: '100%', maxWidth: '380px', margin: 'auto', padding: '24px 0' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.01em', margin: '0 0 8px' }}>로그인</h2>
          <p style={{ color: '#6B7280', fontSize: '13.5px', margin: '0 0 28px', lineHeight: 1.55 }}>Google 계정으로 접속하여 회원 가입없이 시작하세요.</p>

          {/* Google */}
          <button onClick={handleGoogle} disabled={loading} style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '13.5px', fontWeight: 500, color: '#111827', cursor: 'pointer', transition: 'background 0.18s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <svg viewBox="0 0 18 18" width="18" height="18">
              <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.12-.84 2.07-1.79 2.71v2.26h2.9c1.69-1.56 2.69-3.85 2.69-6.62z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.59-5.04-3.71H.96v2.33A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.96 10.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V4.96H.96A8.996 8.996 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" fill="#FBBC05"/>
              <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3 2.33C4.67 5.17 6.66 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Google로 로그인
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0', fontSize: '11.5px', color: '#9CA3AF' }}>
            <span style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
            또는 이메일로
            <span style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmail}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, marginBottom: '6px', color: '#4B5563' }}>이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.18s ease, box-shadow 0.18s ease' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 500, color: '#4B5563' }}>비밀번호</label>
                <a href="#" style={{ fontSize: '11.5px', color: '#4F46E5', textDecoration: 'none' }}>비밀번호를 잊으셨나요?</a>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" required style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.18s ease, box-shadow 0.18s ease' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {signupSuccess && <p style={{ fontSize: '12.5px', color: '#15803D', margin: '0 0 12px', padding: '10px 12px', background: 'rgba(21,128,61,0.06)', borderRadius: '8px', border: '1px solid rgba(21,128,61,0.2)' }}>회원가입이 완료됐습니다. 이메일과 비밀번호로 로그인하세요.</p>}
          {error && <p style={{ fontSize: '12.5px', color: '#DC2626', margin: '0 0 12px', padding: '10px 12px', background: 'rgba(220,38,38,0.06)', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.2)' }}>{error}</p>}

            <button type="submit" disabled={loading} style={{ width: '100%', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 12px rgba(79,70,229,0.25)', cursor: loading ? 'not-allowed' : 'pointer', border: 'none', opacity: loading ? 0.7 : 1, transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(79,70,229,0.32)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.25)'; }}
            >
              {loading ? '처리 중...' : '로그인'}
            </button>
          </form>

          <div style={{ marginTop: '22px', padding: '12px 14px', background: '#FAFAFA', border: '1px solid #F3F4F6', borderRadius: '10px', fontSize: '12px', color: '#4B5563', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(79,70,229,0.10)', color: '#4F46E5', display: 'grid', placeItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            Chrome 확장 사용자도 여기서 로그인하세요.
          </div>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
