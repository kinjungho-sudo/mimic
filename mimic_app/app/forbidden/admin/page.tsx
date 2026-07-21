import Link from 'next/link';
import { BrandMark } from '@/components/common/BrandMark';
import { BRAND_COLORS, BRAND_NAME } from '@/lib/brand';

export default function AdminForbiddenPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#F8FAFC', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <section style={{ width: 'min(440px, 100%)', padding: '32px', borderRadius: '16px', border: '1px solid #E2E8F0', background: 'white', boxShadow: '0 16px 40px rgba(15,23,42,0.08)', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '22px' }}>
          <BrandMark size={30} />
          <strong style={{ color: '#0F172A', fontSize: '16px' }}>{BRAND_NAME}</strong>
        </div>
        <div style={{ width: '52px', height: '52px', display: 'grid', placeItems: 'center', margin: '0 auto 16px', borderRadius: '50%', background: '#FFF7ED', color: '#C2410C', fontSize: '24px' }}>!</div>
        <h1 style={{ margin: '0 0 8px', fontSize: '22px', color: '#0F172A' }}>관리자 권한이 필요합니다</h1>
        <p style={{ margin: '0 0 24px', color: '#64748B', fontSize: '14px', lineHeight: 1.7 }}>현재 계정은 관리자 페이지를 열 수 없습니다. 일반 대시보드로 돌아가거나 관리자 계정으로 다시 로그인해주세요.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/home" style={{ padding: '10px 16px', borderRadius: '9px', background: BRAND_COLORS.primary, color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>홈으로 돌아가기</Link>
          <Link href="/auth/login" style={{ padding: '10px 16px', borderRadius: '9px', border: '1px solid #CBD5E1', color: '#475569', textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}>다른 계정으로 로그인</Link>
        </div>
      </section>
    </main>
  );
}
