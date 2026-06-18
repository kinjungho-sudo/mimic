'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Tutorial, PageAuthor } from '@/types';

// BlockNote 는 클라이언트 전용 → SSR 비활성화
const GuidebookEditor = dynamic(() => import('@/components/guidebook/GuidebookEditor'), {
  ssr: false,
  loading: () => <div style={{ padding: '40px 0', color: '#9CA3AF', fontSize: '13px' }}>에디터 불러오는 중…</div>,
});

const BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 12px',
  borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white',
  color: '#374151', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
  } catch { return ''; }
}

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [author, setAuthor] = useState<PageAuthor | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [initialContent, setInitialContent] = useState<unknown[] | null>(null);
  const [tutorials, setTutorials] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const titleRef = useRef('');
  const contentRef = useRef<unknown[]>([]);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 로드 ──
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/pages/${id}`);
      if (res.status === 401) { router.push(`/auth/login?next=/pages/${id}/editor`); return; }
      if (res.ok) {
        const p = await res.json();
        setTitle(p.title ?? '');
        titleRef.current = p.title ?? '';
        setStatus(p.status);
        setShareToken(p.share_token ?? null);
        setAuthor(p.author ?? null);
        setCreatedAt(p.created_at ?? null);
        const c = Array.isArray(p.content) ? p.content : [];
        contentRef.current = c;
        setInitialContent(c);
      }
      setLoading(false);
    })();
    fetch('/api/tutorials')
      .then(r => r.ok ? r.json() : [])
      .then((list: Tutorial[]) => setTutorials((list ?? []).map(t => ({ id: t.id, title: t.title }))))
      .catch(() => {});
  }, [id, router]);

  // ── 저장 ──
  const persist = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/pages/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleRef.current, content: contentRef.current }),
      });
      setSavedAt(Date.now());
      dirtyRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [id]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(), 1000);
  }, [persist]);

  const onTitleChange = (v: string) => { setTitle(v); titleRef.current = v; scheduleSave(); };
  const onContentChange = useCallback((doc: unknown[]) => { contentRef.current = doc; scheduleSave(); }, [scheduleSave]);

  // ── 게시 ──
  const publish = async () => {
    if (dirtyRef.current) await persist();
    const res = await fetch(`/api/pages/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish: true }),
    });
    if (res.ok) {
      const p = await res.json();
      setStatus('published');
      setShareToken(p.share_token);
      setShareOpen(true);
    }
  };
  const unpublish = async () => {
    const res = await fetch(`/api/pages/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unpublish: true }),
    });
    if (res.ok) { setStatus('draft'); setShareToken(null); setShareOpen(false); }
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>불러오는 중…</div>;

  const shareUrl = shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${shareToken}` : '';
  const authorLabel = author?.name || author?.email || '';

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* 헤더 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderBottom: '1px solid #E5E7EB', background: 'white' }}>
        <Link href="/pages" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#6B7280', textDecoration: 'none', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          플레이북
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>
          {saving ? '저장 중…' : savedAt ? '저장됨' : ''}
        </span>
        {status === 'published' && shareToken && (
          <button onClick={() => setShareOpen(true)} style={BTN}>공유 링크</button>
        )}
        {status === 'published'
          ? <button onClick={unpublish} style={BTN}>게시 취소</button>
          : <button onClick={publish} style={{ ...BTN, border: 'none', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', fontWeight: 600 }}>게시하기</button>}
      </div>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 24px 120px' }}>
        {/* 제목 */}
        <input
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="제목 없는 플레이북"
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '38px', fontWeight: 800, color: '#111827', fontFamily: 'inherit', lineHeight: 1.2 }}
        />

        {/* 작성자 · 작성일 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0 28px', fontSize: '12.5px', color: '#9CA3AF' }}>
          {authorLabel && <span>{authorLabel}</span>}
          {authorLabel && createdAt && <span>·</span>}
          {createdAt && <span>{formatDate(createdAt)}</span>}
        </div>

        {/* BlockNote 에디터 */}
        {initialContent !== null && (
          <GuidebookEditor initialContent={initialContent} tutorials={tutorials} onChange={onContentChange} />
        )}
      </div>

      {/* 공유 링크 모달 */}
      {shareOpen && shareToken && (
        <div onClick={() => setShareOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', padding: '24px', width: '440px', maxWidth: 'calc(100vw - 32px)' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>공유 링크</div>
            <div style={{ fontSize: '12.5px', color: '#6B7280', marginBottom: '16px' }}>이 링크로 누구나 플레이북을 볼 수 있어요.</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input readOnly value={shareUrl} style={{ flex: 1, height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12.5px', color: '#374151' }} />
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ ...BTN, border: 'none', background: '#3730a3', color: 'white', fontWeight: 600 }}>복사</button>
            </div>
            <div style={{ marginTop: '14px', textAlign: 'right' }}>
              <a href={shareUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: '#4338CA' }}>새 탭에서 열기 →</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
