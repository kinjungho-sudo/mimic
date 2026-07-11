'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { BrandMark } from '@/components/common/BrandMark';
import { BRAND_COLORS, BRAND_NAME } from '@/lib/brand';

const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND_COLORS.primary}, ${BRAND_COLORS.guide})`;
const BRAND_SOFT_GRADIENT = `linear-gradient(135deg, ${BRAND_COLORS.guideSoft}, #F7FFF8)`;
const BRAND_SHADOW = '0 4px 14px rgba(0,155,142,0.28)';

type InviteInfo = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  workspace: { name: string };
  inviter: { name: string };
};

export default function WorkspaceInvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/workspace-invite/${token}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) setError(data.error ?? '유효하지 않은 초대입니다.');
        else setInfo(data);
      })
      .catch(() => setError('초대 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/workspace-invite/${token}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/auth/login?next=/workspace/invite/${token}`);
          return;
        }
        setError(data.error ?? '수락에 실패했습니다.');
        return;
      }
      router.push(`/workspace/${data.workspace_id}`);
    } catch {
      setError('수락 중 오류가 발생했습니다.');
    } finally {
      setAccepting(false);
    }
  };

  const roleLabel = (role: string) => ({ admin: '관리자', editor: '편집자', viewer: '뷰어' })[role] ?? role;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8F9FA', padding: '24px',
      fontFamily: "'Pretendard Variable', -apple-system, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#111827' }}>
            <BrandMark size={32} />
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>{BRAND_NAME}</span>
          </Link>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '36px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: '14px' }}>초대 정보 확인 중...</div>
          ) : error ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#FEE2E2', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>초대를 사용할 수 없습니다</div>
              <div style={{ fontSize: '13.5px', color: '#6B7280', marginBottom: '24px' }}>{error}</div>
              <Link href="/home" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: '9px', background: BRAND_COLORS.primary, color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>홈으로 돌아가기</Link>
            </div>
          ) : info ? (
            <div>
              {/* 워크스페이스 아이콘 */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '14px', background: BRAND_SOFT_GRADIENT, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={BRAND_COLORS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
              </div>

              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', textAlign: 'center', margin: '0 0 8px' }}>
                팀 워크스페이스 초대
              </h1>
              <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', margin: '0 0 28px', lineHeight: 1.6 }}>
                <strong style={{ color: '#111827' }}>{info.inviter.name}</strong>님이<br />
                <strong style={{ color: BRAND_COLORS.primary }}>{info.workspace.name}</strong> 워크스페이스에 초대했습니다.
              </p>

              {/* 초대 정보 */}
              <div style={{ background: '#F9FAFB', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>초대 이메일</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{info.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>부여 권한</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 10px', borderRadius: '999px', background: BRAND_COLORS.guideSoft, color: BRAND_COLORS.primary }}>{roleLabel(info.role)}</span>
                </div>
              </div>

              <button
                onClick={handleAccept}
                disabled={accepting}
                style={{
                  width: '100%', padding: '13px', borderRadius: '10px',
                  background: accepting ? '#9CA3AF' : BRAND_GRADIENT,
                  color: 'white', border: 'none', cursor: accepting ? 'not-allowed' : 'pointer',
                  fontSize: '15px', fontWeight: 600, boxShadow: BRAND_SHADOW,
                }}
              >
                {accepting ? '수락 중...' : '초대 수락하기'}
              </button>
              <p style={{ textAlign: 'center', margin: '16px 0 0', fontSize: '12px', color: '#9CA3AF' }}>
                초대받은 이메일로 로그인된 상태여야 합니다.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
