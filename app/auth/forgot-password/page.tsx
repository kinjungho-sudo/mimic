'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPassword } from '@/lib/auth-client';
import { BrandMark } from '@/components/BrandMark';

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get('email') ?? '';
  const [email, setEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44% 56%', minHeight: '100vh', fontFamily: "'Pretendard', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif" }}>

      {/* Left brand panel */}
      <aside style={{ background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', padding: '56px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(600px 320px at 100% 0%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(500px 280px at 0% 100%, rgba(0,0,0,0.18), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Link href="/landingpage" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 500, color: 'white', textDecoration: 'none' }}>
            <BrandMark /> MIMIC
          </Link>
          <div style={{ marginTop: 'auto', paddingBottom: '8px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.25, margin: '0 0 14px' }}>비밀번호를 잊으셨나요?</h1>
            <p style={{ fontSize: '14.5px', opacity: 0.85, maxWidth: '380px', lineHeight: 1.6, margin: 0 }}>가입 시 사용한 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.</p>
          </div>
          <div style={{ marginTop: '36px', fontSize: '11.5px', opacity: 0.6 }}>© 2026 코마인드웍스</div>
        </div>
      </aside>

      {/* Right form panel */}
      <section style={{ display: 'flex', flexDirection: 'column', padding: '36px 64px', background: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#6B7280' }}>
          기억이 나셨나요?
          <Link href="/auth/login" style={{ color: '#3730a3', fontWeight: 500, marginLeft: '4px', textDecoration: 'none' }}>로그인</Link>
        </div>

        <div style={{ width: '100%', maxWidth: '380px', margin: 'auto', padding: '24px 0' }}>
          {sent ? (
            <div>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(55,48,163,0.10)', display: 'grid', placeItems: 'center', marginBottom: '20px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.01em', margin: '0 0 10px' }}>메일을 확인해주세요</h2>
              <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: 1.65, margin: '0 0 24px' }}>
                <strong style={{ color: '#111827' }}>{email}</strong>으로 비밀번호 재설정 링크를 보냈습니다.<br />
                메일이 오지 않으면 스팸함을 확인하거나 아래 버튼으로 재발송해주세요.
              </p>
              <button
                onClick={() => { setSent(false); }}
                style={{ fontSize: '13px', color: '#3730a3', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                다른 이메일로 재시도
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.01em', margin: '0 0 8px' }}>비밀번호 재설정</h2>
              <p style={{ color: '#6B7280', fontSize: '13.5px', margin: '0 0 28px', lineHeight: 1.55 }}>가입한 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.</p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, marginBottom: '6px', color: '#4B5563' }}>이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.18s ease, box-shadow 0.18s ease' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3730a3'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(55,48,163,0.12)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                {error && <p style={{ fontSize: '12.5px', color: '#DC2626', margin: '0 0 12px', padding: '10px 12px', background: 'rgba(220,38,38,0.06)', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.2)' }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 12px rgba(55,48,163,0.25)', cursor: loading ? 'not-allowed' : 'pointer', border: 'none', opacity: loading ? 0.7 : 1, transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(55,48,163,0.32)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(55,48,163,0.25)'; }}
                >
                  {loading ? '전송 중...' : '재설정 링크 보내기'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
