'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BrandMark } from '@/components/BrandMark';

function getPasswordStrength(pw: string): { level: number; label: string } {
  if (!pw) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['', '약함', '보통', '강함', '강함 — 소문자, 숫자, 특수문자 포함 ✓'];
  return { level: score, label: labels[score] };
}

const strengthColors = ['#F3F4F6', '#DC2626', '#F59E0B', '#84CC16', '#10B981'];

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  const { level, label } = getPasswordStrength(password);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    // 페이지 진입 시 이미 세션이 있는 경우(콜백 후 리디렉션)도 처리
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => router.push('/auth/login?reset=success'), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
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
            <h1 style={{ fontSize: '36px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.25, margin: '0 0 14px' }}>새 비밀번호 설정</h1>
            <p style={{ fontSize: '14.5px', opacity: 0.85, maxWidth: '380px', lineHeight: 1.6, margin: 0 }}>안전한 비밀번호로 변경하시면 바로 로그인하실 수 있습니다.</p>
          </div>
          <div style={{ marginTop: '36px', fontSize: '11.5px', opacity: 0.6 }}>© 2026 코마인드웍스</div>
        </div>
      </aside>

      {/* Right form panel */}
      <section style={{ display: 'flex', flexDirection: 'column', padding: '36px 64px', background: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '13px', color: '#6B7280' }}>
          <Link href="/auth/login" style={{ color: '#4F46E5', fontWeight: 500, textDecoration: 'none' }}>로그인으로 돌아가기</Link>
        </div>

        <div style={{ width: '100%', maxWidth: '380px', margin: 'auto', padding: '24px 0' }}>
          {done ? (
            <div>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(16,185,129,0.10)', display: 'grid', placeItems: 'center', marginBottom: '20px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 10px' }}>비밀번호가 변경됐습니다</h2>
              <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: 1.65 }}>잠시 후 로그인 페이지로 이동합니다.</p>
            </div>
          ) : !sessionReady ? (
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 12px' }}>링크를 확인 중입니다...</h2>
              <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: 1.65, margin: '0 0 20px' }}>
                재설정 링크가 만료됐거나 이미 사용된 경우 아래에서 다시 요청하세요.
              </p>
              <Link href="/auth/forgot-password" style={{ display: 'inline-block', padding: '10px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', fontSize: '13.5px', fontWeight: 500, textDecoration: 'none' }}>
                재설정 링크 다시 받기
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.01em', margin: '0 0 8px' }}>새 비밀번호 설정</h2>
              <p style={{ color: '#6B7280', fontSize: '13.5px', margin: '0 0 28px', lineHeight: 1.55 }}>8자 이상의 새 비밀번호를 입력해주세요.</p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, marginBottom: '6px', color: '#4B5563' }}>새 비밀번호</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8자 이상"
                    required
                    style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.18s ease, box-shadow 0.18s ease' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  {password && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '8px' }}>
                        {[1, 2, 3, 4].map(i => (
                          <span key={i} style={{ height: '4px', borderRadius: '2px', background: i <= level ? strengthColors[level] : '#F3F4F6', transition: 'background 0.2s' }} />
                        ))}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '6px' }}>{label}</div>
                    </>
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, marginBottom: '6px', color: '#4B5563' }}>비밀번호 확인</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    required
                    style={{ width: '100%', height: '40px', padding: '0 12px', border: `1px solid ${confirm && confirm !== password ? '#DC2626' : '#E5E7EB'}`, borderRadius: '8px', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.18s ease, box-shadow 0.18s ease' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = confirm && confirm !== password ? '#DC2626' : '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  {confirm && confirm !== password && (
                    <div style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '5px' }}>비밀번호가 일치하지 않습니다.</div>
                  )}
                </div>

                {error && <p style={{ fontSize: '12.5px', color: '#DC2626', margin: '0 0 12px', padding: '10px 12px', background: 'rgba(220,38,38,0.06)', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.2)' }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading || (!!confirm && confirm !== password)}
                  style={{ width: '100%', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 12px rgba(79,70,229,0.25)', cursor: loading ? 'not-allowed' : 'pointer', border: 'none', opacity: loading ? 0.7 : 1, transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(79,70,229,0.32)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.25)'; }}
                >
                  {loading ? '변경 중...' : '비밀번호 변경하기'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
