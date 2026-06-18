'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Page } from '@/types';

export default function PagesListPage() {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pages');
      if (res.status === 401) { router.push('/auth/login?next=/pages'); return; }
      if (res.ok) setPages(await res.json());
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const createPage = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) return;
      const page = await res.json();
      router.push(`/pages/${page.id}/editor`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', borderBottom: '1px solid #E5E7EB', background: 'white' }}>
        <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#6B7280', textDecoration: 'none', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          홈
        </Link>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>플레이북</h1>
        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>여러 가이드를 하나의 문서로 엮어보세요</span>
        <div style={{ flex: 1 }} />
        <button onClick={createPage} disabled={creating}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 16px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: creating ? 'default' : 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          새 플레이북
        </button>
      </div>

      {/* 목록 */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>불러오는 중…</div>
        ) : pages.length === 0 ? (
          <div style={{ padding: '72px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>아직 만든 플레이북이 없어요</div>
            <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '20px', lineHeight: 1.6 }}>
              여러 가이드와 설명·영상을 한 페이지로 엮어<br />온보딩 문서나 업무 매뉴얼을 만들 수 있어요.
            </div>
            <button onClick={createPage} disabled={creating}
              style={{ height: '40px', padding: '0 20px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              첫 플레이북 만들기
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {pages.map(p => (
              <Link key={p.id} href={`/pages/${p.id}/editor`}
                style={{ display: 'block', textDecoration: 'none', background: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', transition: 'box-shadow 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#C7D2FE'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
                <div style={{ height: '88px', background: p.cover_color || 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)' }} />
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: '#9CA3AF' }}>
                    <span>{p.block_count ?? 0}개 블록</span>
                    <span>·</span>
                    <span style={{ color: p.status === 'published' ? '#059669' : '#9CA3AF', fontWeight: p.status === 'published' ? 600 : 400 }}>
                      {p.status === 'published' ? '게시됨' : '초안'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
