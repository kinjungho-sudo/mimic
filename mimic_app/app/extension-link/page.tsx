'use client';

import { useRouter } from 'next/navigation';
import { useExtensionLink } from '@/hooks/useExtensionLink';
import { BrandMark } from '@/components/common/BrandMark';
import { BRAND_EXTENSION_NAME, BRAND_NAME } from '@/lib/brand';

// 웹스토어에 올라간 건 운영 확장 하나뿐 → 항상 운영 리스팅으로 보낸다(RecordingModal과 동일 URL).
const STORE_URL = 'https://chromewebstore.google.com/detail/mimic-recorder/ehbhcdkapcbfehinjapabgoegcjmmbgd';

export default function ExtensionLinkPage() {
  const router = useRouter();
  const { state, countdown, retry } = useExtensionLink(() => router.push('/home'));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', background: '#FAFAFA', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '480px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '18px', padding: '44px 40px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(500px 220px at 50% -120px, rgba(124,58,237,0.10), transparent 60%)', pointerEvents: 'none' }} />

        <a href="/landingpage" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, marginBottom: '28px', color: '#111827', textDecoration: 'none' }}>
          <BrandMark /> {BRAND_NAME}
        </a>

        {/* 연결 시도 중 */}
        {state === 'loading' && (
          <div style={{ position: 'relative' }}>
            <div style={{ width: '96px', height: '96px', margin: '0 auto 22px', borderRadius: '24px', background: 'linear-gradient(135deg, #e0e7ff, #F5F3FF)', display: 'grid', placeItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '4px solid rgba(55,48,163,0.18)', borderTopColor: '#3730a3', animation: 'spin 0.9s linear infinite' }} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 500, margin: '0 0 8px', color: '#111827' }}>{BRAND_EXTENSION_NAME} 확인 중…</h1>
            <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.6, margin: '0 auto', maxWidth: '340px' }}>확장 프로그램 설치 여부를 확인하고 있어요.</p>
          </div>
        )}

        {/* 연결 성공 */}
        {state === 'success' && (
          <div style={{ position: 'relative' }}>
            <div style={{ width: '96px', height: '96px', margin: '0 auto 22px', borderRadius: '24px', background: 'linear-gradient(135deg, #e0e7ff, #F5F3FF)', display: 'grid', placeItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', display: 'grid', placeItems: 'center', color: 'white', boxShadow: '0 8px 20px rgba(55,48,163,0.35)', animation: 'pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 500, margin: '0 0 8px', color: '#111827' }}>{BRAND_EXTENSION_NAME} 연결 완료</h1>
            <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.6, margin: '0 auto 20px', maxWidth: '360px' }}>브라우저 우상단의 {BRAND_EXTENSION_NAME} 아이콘으로 바로 매뉴얼을 만들 수 있어요.</p>
            <div style={{ fontSize: '11.5px', color: '#6B7280', marginBottom: '22px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', animation: 'dotPulse 1.2s ease-in-out infinite' }} />
              {countdown}초 후 워크스페이스로 이동합니다…
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px', margin: '0 auto' }}>
              <button onClick={() => router.push('/home')}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(55,48,163,0.25)' }}>
                지금 워크스페이스로 가기
              </button>
            </div>
          </div>
        )}

        {/* 미설치 — 설치 유도 */}
        {state === 'not_installed' && (
          <div style={{ position: 'relative' }}>
            <div style={{ width: '96px', height: '96px', margin: '0 auto 22px', borderRadius: '24px', background: 'linear-gradient(135deg, #e0e7ff, #F5F3FF)', display: 'grid', placeItems: 'center', color: '#3730a3' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
                <line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
                <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
              </svg>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 500, margin: '0 0 8px', color: '#111827' }}>{BRAND_EXTENSION_NAME}가 없어요</h1>
            <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.6, margin: '0 auto 6px', maxWidth: '360px' }}>
              Chrome 확장 프로그램을 먼저 설치해야 매뉴얼을 만들 수 있어요.
            </p>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 auto 26px', maxWidth: '360px' }}>
              설치 후 이 페이지로 다시 돌아오면 자동으로 연결됩니다.
            </p>

            {/* 설치 단계 안내 */}
            <div style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', textAlign: 'left' }}>
              {[
                '아래 버튼을 눌러 Chrome 웹스토어로 이동',
                '\'Chrome에 추가\' 버튼 클릭',
                '이 페이지로 돌아와 \'연결 다시 시도\' 클릭',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < 2 ? '10px' : 0 }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: 600, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: '1px' }}>{i + 1}</span>
                  <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px', margin: '0 auto' }}>
              <a
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '14px', fontWeight: 500, textDecoration: 'none', boxShadow: '0 4px 12px rgba(55,48,163,0.25)', boxSizing: 'border-box' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {BRAND_EXTENSION_NAME} 설치하기
              </a>
              <button
                onClick={retry}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'white', color: '#4B5563', fontSize: '14px', fontWeight: 500, border: '1px solid #E5E7EB', cursor: 'pointer' }}>
                연결 다시 시도
              </button>
              <button
                onClick={() => router.push('/home')}
                style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', background: 'none', color: '#9CA3AF', fontSize: '13px', fontWeight: 400, border: 'none', cursor: 'pointer' }}>
                나중에 설치하고 워크스페이스로
              </button>
            </div>

            <div style={{ marginTop: '22px', paddingTop: '22px', borderTop: '1px solid #F3F4F6', fontSize: '11.5px', color: '#6B7280', position: 'relative' }}>
              설치에 어려움이 있으신가요?{' '}
              <a href="mailto:kinjungho@gmail.com" style={{ color: '#3730a3', fontWeight: 500 }}>문의하기</a>
            </div>
          </div>
        )}

        {/* 설치됐는데 연결 실패 (서버 오류 등) */}
        {state === 'error' && (
          <div style={{ position: 'relative' }}>
            <div style={{ width: '96px', height: '96px', margin: '0 auto 22px', borderRadius: '24px', background: 'linear-gradient(135deg, #FEF3C7, #FEF9EE)', display: 'grid', placeItems: 'center', color: '#F59E0B' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 500, margin: '0 0 8px', color: '#111827' }}>연결에 실패했어요</h1>
            <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.6, margin: '0 auto 26px', maxWidth: '360px' }}>
              확장 프로그램이 설치되어 있지만 연결에 실패했어요. 확장이 활성화되어 있는지 확인 후 다시 시도해주세요.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px', margin: '0 auto' }}>
              <button onClick={retry}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(55,48,163,0.25)' }}>
                다시 시도
              </button>
              <button onClick={() => router.push('/home')}
                style={{ width: '100%', padding: '10px 16px', borderRadius: '10px', background: 'none', color: '#9CA3AF', fontSize: '13px', fontWeight: 400, border: 'none', cursor: 'pointer' }}>
                건너뛰고 워크스페이스로
              </button>
            </div>
            <div style={{ marginTop: '22px', paddingTop: '22px', borderTop: '1px solid #F3F4F6', fontSize: '11.5px', color: '#6B7280', position: 'relative' }}>
              문제가 계속되나요?{' '}
              <a href="mailto:kinjungho@gmail.com" style={{ color: '#3730a3', fontWeight: 500 }}>문의하기</a>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes dotPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
