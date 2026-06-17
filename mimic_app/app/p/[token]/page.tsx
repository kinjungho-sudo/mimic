'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { GuideData } from '@/components/guidebook/schema';

const GuidebookView = dynamic(() => import('@/components/guidebook/GuidebookView'), {
  ssr: false,
  loading: () => <div style={{ padding: '40px 0', color: '#9CA3AF', fontSize: '13px' }}>불러오는 중…</div>,
});

interface PubPage {
  title: string;
  description: string | null;
  cover_color: string | null;
  published_at: string | null;
  author: { name: string | null; email: string | null; avatar_url: string | null } | null;
  content: unknown[];
  guides: Record<string, GuideData | null>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
  } catch { return ''; }
}

export default function PublicPage() {
  const { token } = useParams<{ token: string }>();
  const [page, setPage] = useState<PubPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/p/${token}`);
      if (res.ok) setPage(await res.json());
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: '#9CA3AF' }}>불러오는 중…</div>;
  if (!page) return <div style={{ padding: '80px', textAlign: 'center', color: '#6B7280' }}>페이지를 찾을 수 없습니다.</div>;

  const authorLabel = page.author?.name || page.author?.email || '';

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      {/* 커버 */}
      <div style={{ height: '140px', background: page.cover_color || 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)' }} />

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '0 24px 120px' }}>
        <div style={{ marginTop: '-36px', background: 'white', borderRadius: '14px', padding: '32px 28px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: '32px', fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{page.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#9CA3AF', marginBottom: page.description ? '12px' : '24px' }}>
            {authorLabel && <span>{authorLabel}</span>}
            {authorLabel && page.published_at && <span>·</span>}
            {page.published_at && <span>{formatDate(page.published_at)}</span>}
          </div>
          {page.description && <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6B7280', lineHeight: 1.7 }}>{page.description}</p>}

          <GuidebookView content={page.content} guides={page.guides} />
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11.5px', color: '#9CA3AF' }}>
          Made with MIMIC
        </div>
      </div>
    </div>
  );
}
