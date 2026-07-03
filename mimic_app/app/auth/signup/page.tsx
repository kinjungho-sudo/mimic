'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signUpWithEmail } from '@/lib/auth/auth-client';
import { BrandMark } from '@/components/common/BrandMark';

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

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreeAge, setAgreeAge] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  const allRequired = agreeAge && agreeTerms && agreePrivacy;
  const allChecked = allRequired && agreeMarketing;

  const handleAgreeAll = (checked: boolean) => {
    setAgreeAge(checked);
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeMarketing(checked);
  };

  const { level, label } = getPasswordStrength(password);
  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const INVISIBLE = new Set([0x00AD, 0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF]);
  const sanitize = (s: string) =>
    s.split('').filter(c => !INVISIBLE.has(c.charCodeAt(0))).join('').trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequired) { setError('필수 항목에 모두 동의해주세요.'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    setError('');
    try {
      await signUpWithEmail(sanitize(name), sanitize(email), sanitize(password), sanitize(passwordConfirm), {
        age14: agreeAge,
        terms: agreeTerms,
        privacy: agreePrivacy,
        marketing: agreeMarketing,
      });
      router.push('/auth/login?signup=success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '회원가입 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', height: '40px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.18s ease, box-shadow 0.18s ease' };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#3730a3'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(55,48,163,0.12)'; };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; };

  return (
    <div className="auth-grid" style={{ fontFamily: "'Pretendard', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif" }}>

      {/* Left brand panel — 모바일에서 숨김 */}
      <aside className="auth-brand-panel" style={{ background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', padding: '56px', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(600px 320px at 100% 0%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(500px 280px at 0% 100%, rgba(0,0,0,0.18), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Link href="/landingpage" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 500, color: 'white', textDecoration: 'none' }}>
            <BrandMark /> MIMIC
          </Link>

          <div style={{ marginTop: 'auto', paddingBottom: '8px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.25, margin: '0 0 14px' }}>5분 만에 시작하세요</h1>
            <p style={{ fontSize: '14.5px', opacity: 0.85, maxWidth: '420px', lineHeight: 1.6, margin: '0 0 36px' }}>사람들이 따라하는 매뉴얼은, 만드는 것부터 다릅니다. 지금 무료로 경험해보세요.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>, title: '무료로 시작, 신용카드 불필요', sub: '회원가입 즉시 모든 기본 기능 사용 가능.' },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, title: '매일 매뉴얼 3개까지 무료', sub: '매일 자정에 한도가 초기화됩니다.' },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: '언제든 업그레이드 가능', sub: '필요할 때만 결제. 부담 없이 둘러보세요.' },
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

        </div>
      </aside>

      {/* Right form panel */}
      <section className="auth-form-panel" style={{ display: 'flex', flexDirection: 'column', padding: '36px 64px', background: 'white', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#6B7280' }}>
          이미 계정이 있으신가요?
          <Link href="/auth/login" style={{ color: '#3730a3', fontWeight: 500, marginLeft: '4px', textDecoration: 'none' }}>로그인</Link>
        </div>

        <div className="auth-form-inner" style={{ width: '100%', maxWidth: '380px', margin: 'auto', padding: '24px 0' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.01em', margin: '0 0 8px' }}>회원가입</h2>
          <p style={{ color: '#6B7280', fontSize: '13.5px', margin: '0 0 28px', lineHeight: 1.55 }}>누구나 쉽게, 무료로 시작해보세요.</p>

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
            Google로 가입하기
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0', fontSize: '11.5px', color: '#9CA3AF' }}>
            <span style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
            또는 이메일로
            <span style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
          </div>

          <form onSubmit={handleSubmit}>
            {/* Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, marginBottom: '6px', color: '#4B5563' }}>이름</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" required style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            </div>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, marginBottom: '6px', color: '#4B5563' }}>이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, marginBottom: '6px', color: '#4B5563' }}>비밀번호</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8자 이상" required style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
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

            {/* Password confirm */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, marginBottom: '6px', color: '#4B5563' }}>비밀번호 확인</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호를 한 번 더 입력"
                required
                style={{ ...inputStyle, borderColor: passwordMismatch ? '#DC2626' : '#E5E7EB' }}
                onFocus={inputFocus}
                onBlur={e => {
                  e.currentTarget.style.borderColor = passwordMismatch ? '#DC2626' : '#E5E7EB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {passwordConfirm && (
                <div style={{ fontSize: '11px', color: passwordMismatch ? '#DC2626' : '#16A34A', marginTop: '6px' }}>
                  {passwordMismatch ? '비밀번호가 일치하지 않습니다.' : '비밀번호가 일치합니다.'}
                </div>
              )}
            </div>

            {/* PIPA agreements */}
            <div style={{ background: '#FAFAFA', border: '1px solid #F3F4F6', borderRadius: '10px', padding: '14px', margin: '18px 0 20px' }}>
              {/* All agree */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid #F3F4F6', marginBottom: '12px', fontSize: '13px', fontWeight: 500, color: '#111827', cursor: 'pointer' }}>
                <span style={{ position: 'relative', width: '16px', height: '16px', flexShrink: 0 }}>
                  <input type="checkbox" checked={allChecked} onChange={e => handleAgreeAll(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }} />
                  <span style={{ display: 'block', width: '16px', height: '16px', border: `2px solid ${allChecked ? '#3730a3' : '#D1D5DB'}`, borderRadius: '4px', background: allChecked ? '#3730a3' : 'white', transition: 'all 0.15s' }}>
                    {allChecked && <svg viewBox="0 0 12 12" width="10" height="10" style={{ position: 'absolute', top: '1px', left: '1px' }}><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                </span>
                전체 동의
              </label>

              {/* Individual rows */}
              {[
                { label: '[필수]', text: '만 14세 이상입니다', checked: agreeAge, set: setAgreeAge, link: null },
                { label: '[필수]', text: '이용약관 동의', checked: agreeTerms, set: setAgreeTerms, link: '/legal/terms' },
                { label: '[필수]', text: '개인정보 수집·이용 동의 (위탁 정보 포함)', checked: agreePrivacy, set: setAgreePrivacy, link: '/legal/privacy' },
                { label: '[선택]', text: '마케팅 정보 수신 동의', checked: agreeMarketing, set: setAgreeMarketing, link: null },
              ].map(row => (
                <label key={row.text} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '12.5px', cursor: 'pointer' }}>
                  <span style={{ position: 'relative', width: '16px', height: '16px', flexShrink: 0 }}>
                    <input type="checkbox" checked={row.checked} onChange={e => row.set(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }} />
                    <span style={{ display: 'block', width: '16px', height: '16px', border: `2px solid ${row.checked ? '#3730a3' : '#D1D5DB'}`, borderRadius: '4px', background: row.checked ? '#3730a3' : 'white', transition: 'all 0.15s' }}>
                      {row.checked && <svg viewBox="0 0 12 12" width="10" height="10" style={{ position: 'absolute', top: '1px', left: '1px' }}><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                  </span>
                  <span style={{ color: row.label === '[선택]' ? '#6B7280' : '#3730a3', fontWeight: 500, flexShrink: 0, fontSize: '11.5px' }}>{row.label}</span>
                  <span style={{ flex: 1, color: '#374151' }}>{row.text}</span>
                  {row.link && <a href={row.link} style={{ marginLeft: 'auto', fontSize: '11px', color: '#9CA3AF', textDecoration: 'underline', flexShrink: 0 }} onClick={e => e.stopPropagation()}>보기</a>}
                </label>
              ))}
            </div>

            {error && <p style={{ fontSize: '12.5px', color: '#DC2626', margin: '0 0 12px', padding: '10px 12px', background: 'rgba(220,38,38,0.06)', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.2)' }}>{error}</p>}

            <button type="submit" disabled={loading} style={{ width: '100%', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 12px rgba(55,48,163,0.25)', cursor: loading ? 'not-allowed' : 'pointer', border: 'none', opacity: loading ? 0.7 : 1, transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(55,48,163,0.32)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(55,48,163,0.25)'; }}
            >
              {loading ? '처리 중...' : '무료로 시작하기'}
            </button>
          </form>

        </div>
      </section>
    </div>
  );
}
