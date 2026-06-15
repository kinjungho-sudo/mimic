'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AnnotationPreview } from '@/components/editor/AnnotationPreview';
import type { Annotation } from '@/components/editor/ImageAnnotationEditor';

interface PubStep {
  step_number: number;
  title: string;
  caption: string;
  screenshot_url: string | null;
  annotations: Annotation[];
}
interface PubBlock {
  id: string;
  block_type: 'heading' | 'text' | 'video' | 'tutorial';
  content: Record<string, unknown>;
  tutorial?: { id: string; title: string; steps: PubStep[] } | null;
}
interface PubPage {
  title: string;
  description: string | null;
  cover_color: string | null;
  blocks: PubBlock[];
}

// 영상 URL → 임베드 src 변환 (YouTube / Loom)
function embedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes('loom.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://www.loom.com/embed/${id}`;
    }
  } catch { /* invalid url */ }
  return null;
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

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      {/* 커버 */}
      <div style={{ height: '140px', background: page.cover_color || 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)' }} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px 120px' }}>
        <div style={{ marginTop: '-36px', background: 'white', borderRadius: '14px', padding: '28px 28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 800, color: '#111827' }}>{page.title}</h1>
          {page.description && <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', lineHeight: 1.7 }}>{page.description}</p>}

          <div style={{ marginTop: '24px' }}>
            {page.blocks.map(b => <BlockView key={b.id} block={b} />)}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11.5px', color: '#9CA3AF' }}>
          Made with MIMIC
        </div>
      </div>
    </div>
  );
}

function BlockView({ block }: { block: PubBlock }) {
  const c = block.content;

  if (block.block_type === 'heading') {
    const level = (c.level as number) ?? 2;
    const size = level === 1 ? 24 : level === 3 ? 16 : 19;
    return <div style={{ fontSize: `${size}px`, fontWeight: 700, color: '#111827', margin: '24px 0 8px' }}>{(c.text as string) || ''}</div>;
  }

  if (block.block_type === 'text') {
    return <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: '8px 0' }}>{(c.markdown as string) || ''}</p>;
  }

  if (block.block_type === 'video') {
    const url = (c.url as string) || '';
    const src = embedSrc(url);
    if (!src) return url ? <a href={url} target="_blank" rel="noreferrer" style={{ color: '#4338CA', fontSize: '13px' }}>{url}</a> : null;
    return (
      <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '12px', overflow: 'hidden', margin: '16px 0', background: '#000' }}>
        <iframe src={src} allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
      </div>
    );
  }

  if (block.block_type === 'tutorial') {
    return <GuideBlock block={block} />;
  }

  return null;
}

// 가이드 임베드 — 접기/펼치기. 펼치면 현재 페이지에서 전체 스텝을 인라인으로 표시.
function GuideBlock({ block }: { block: PubBlock }) {
  const defaultOpen = !!block.content.default_open;
  const [open, setOpen] = useState(defaultOpen);
  const tut = block.tutorial;

  if (!tut) {
    return (
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px 16px', margin: '16px 0', fontSize: '13px', color: '#9CA3AF' }}>
        가이드를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', margin: '16px 0', overflow: 'hidden', background: 'white' }}>
      {/* 헤더 (접힘 상태 카드) */}
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 16px', border: 'none', background: open ? '#FAFAFA' : 'white', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#EEF2FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📘 {tut.title}</span>
          <span style={{ display: 'block', fontSize: '11.5px', color: '#9CA3AF' }}>{tut.steps.length}단계 가이드</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4338CA', fontWeight: 600, flexShrink: 0 }}>
          {open ? '접기' : '펼치기'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>

      {/* 펼침: 전체 스텝 인라인 (새 창/모달 없음) */}
      {open && (
        <div style={{ borderTop: '1px solid #F3F4F6', padding: '8px 0' }}>
          {tut.steps.map((s, i) => (
            <div key={i} style={{ padding: '14px 18px', borderBottom: i < tut.steps.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: s.screenshot_url ? '10px' : 0 }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#3730a3', color: 'white', fontSize: '12px', fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  {s.title && <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{s.title}</div>}
                  {s.caption && <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6, marginTop: '2px' }}>{s.caption}</div>}
                </div>
              </div>
              {s.screenshot_url && (
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #F3F4F6' }}>
                  <AnnotationPreview imageUrl={s.screenshot_url} annotations={s.annotations ?? []} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
