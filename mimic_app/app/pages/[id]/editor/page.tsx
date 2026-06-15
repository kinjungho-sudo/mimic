'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Tutorial, PageBlockType } from '@/types';

// ── 편집용 블록 (안정적 key 부여) ──
interface EditBlock {
  key: string;
  block_type: PageBlockType;
  content: Record<string, unknown>;
}
let keySeq = 0;
const newKey = () => `b${++keySeq}`;

const BTN = (active = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 12px',
  borderRadius: '8px', border: '1px solid #E5E7EB', background: active ? '#EEF2FF' : 'white',
  color: '#374151', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
});

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<EditBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // ── 로드 ──
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/pages/${id}`);
      if (res.status === 401) { router.push(`/auth/login?next=/pages/${id}/editor`); return; }
      if (res.ok) {
        const p = await res.json();
        setTitle(p.title ?? '');
        setStatus(p.status);
        setShareToken(p.share_token ?? null);
        setBlocks((p.blocks ?? []).map((b: { block_type: PageBlockType; content: Record<string, unknown> }) => ({
          key: newKey(), block_type: b.block_type, content: b.content ?? {},
        })));
      }
      setLoading(false);
    })();
    fetch('/api/tutorials').then(r => r.ok ? r.json() : []).then(setTutorials).catch(() => {});
  }, [id, router]);

  const tutorialTitle = useCallback((tid: string) => tutorials.find(t => t.id === tid)?.title ?? '가이드', [tutorials]);

  // ── 저장 (디바운스 자동저장) ──
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(async (curTitle: string, curBlocks: EditBlock[]) => {
    setSaving(true);
    try {
      await fetch(`/api/pages/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: curTitle }),
      });
      await fetch(`/api/pages/${id}/blocks`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: curBlocks.map(b => ({ block_type: b.block_type, content: b.content })) }),
      });
      setSavedAt(Date.now());
      dirtyRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [id]);

  const scheduleSave = useCallback((nextTitle: string, nextBlocks: EditBlock[]) => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(nextTitle, nextBlocks), 1000);
  }, [persist]);

  // 블록 변경 헬퍼
  const mutate = useCallback((next: EditBlock[]) => {
    setBlocks(next);
    scheduleSave(title, next);
  }, [title, scheduleSave]);

  const addBlock = (type: PageBlockType, content: Record<string, unknown> = {}) => {
    const def: Record<PageBlockType, Record<string, unknown>> = {
      heading: { text: '', level: 2 },
      text: { markdown: '' },
      video: { url: '' },
      tutorial: { default_open: false },
    };
    mutate([...blocks, { key: newKey(), block_type: type, content: { ...def[type], ...content } }]);
  };

  const updateBlock = (key: string, content: Record<string, unknown>) =>
    mutate(blocks.map(b => b.key === key ? { ...b, content } : b));

  const removeBlock = (key: string) => mutate(blocks.filter(b => b.key !== key));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    mutate(next);
  };

  // ── 게시 ──
  const publish = async () => {
    if (dirtyRef.current) await persist(title, blocks);
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

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      {/* 헤더 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderBottom: '1px solid #E5E7EB', background: 'white' }}>
        <Link href="/pages" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#6B7280', textDecoration: 'none', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Pages
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>
          {saving ? '저장 중…' : savedAt ? '저장됨' : ''}
        </span>
        {status === 'published' && shareToken && (
          <button onClick={() => setShareOpen(true)} style={BTN()}>공유 링크</button>
        )}
        {status === 'published'
          ? <button onClick={unpublish} style={BTN()}>게시 취소</button>
          : <button onClick={publish} style={{ ...BTN(), border: 'none', background: 'linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)', color: 'white', fontWeight: 600 }}>게시하기</button>}
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 120px' }}>
        {/* 제목 */}
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); scheduleSave(e.target.value, blocks); }}
          placeholder="페이지 제목"
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '30px', fontWeight: 700, color: '#111827', marginBottom: '24px', fontFamily: 'inherit' }}
        />

        {/* 블록 목록 */}
        {blocks.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px', border: '1.5px dashed #E5E7EB', borderRadius: '12px', marginBottom: '20px' }}>
            아래 버튼으로 제목·텍스트·영상·가이드를 추가해 문서를 구성하세요.
          </div>
        )}

        {blocks.map((b, i) => (
          <div key={b.key}
            draggable
            onDragStart={() => { dragIndex.current = i; }}
            onDragOver={e => { e.preventDefault(); setDragOver(i); }}
            onDragLeave={() => setDragOver(prev => prev === i ? null : prev)}
            onDrop={e => { e.preventDefault(); if (dragIndex.current != null) move(dragIndex.current, i); dragIndex.current = null; setDragOver(null); }}
            style={{ position: 'relative', marginBottom: '12px', padding: '4px 0 4px 36px', borderTop: dragOver === i ? '2px solid #6d28d9' : '2px solid transparent' }}
          >
            {/* 좌측 컨트롤 */}
            <div style={{ position: 'absolute', left: 0, top: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span title="드래그로 이동" style={{ cursor: 'grab', color: '#D1D5DB', lineHeight: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
              </span>
            </div>

            <BlockEditor
              block={b}
              tutorialTitle={tutorialTitle}
              onChange={content => updateBlock(b.key, content)}
              onRemove={() => removeBlock(b.key)}
              onMoveUp={() => move(i, i - 1)}
              onMoveDown={() => move(i, i + 1)}
            />
          </div>
        ))}

        {/* 추가 툴바 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
          <button onClick={() => addBlock('heading')} style={BTN()}>＋ 제목</button>
          <button onClick={() => addBlock('text')} style={BTN()}>＋ 텍스트</button>
          <button onClick={() => addBlock('video')} style={BTN()}>＋ 영상</button>
          <button onClick={() => setPickerOpen(true)} style={{ ...BTN(), borderColor: '#C7D2FE', color: '#4338CA', fontWeight: 600 }}>＋ 가이드 추가</button>
        </div>
      </div>

      {/* 가이드 선택 모달 */}
      {pickerOpen && (
        <GuidePicker
          tutorials={tutorials}
          onPick={t => { addBlock('tutorial', { tutorial_id: t.id, default_open: false }); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* 공유 링크 모달 */}
      {shareOpen && shareToken && (
        <div onClick={() => setShareOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', padding: '24px', width: '440px', maxWidth: 'calc(100vw - 32px)' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>공유 링크</div>
            <div style={{ fontSize: '12.5px', color: '#6B7280', marginBottom: '16px' }}>이 링크로 누구나 페이지를 볼 수 있어요.</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input readOnly value={shareUrl} style={{ flex: 1, height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12.5px', color: '#374151' }} />
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ ...BTN(), border: 'none', background: '#3730a3', color: 'white', fontWeight: 600 }}>복사</button>
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

// ── 블록별 편집기 ──
function BlockEditor({ block, tutorialTitle, onChange, onRemove, onMoveUp, onMoveDown }: {
  block: EditBlock;
  tutorialTitle: (tid: string) => string;
  onChange: (content: Record<string, unknown>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const c = block.content;
  const toolbar = (
    <div style={{ display: 'flex', gap: '2px', position: 'absolute', right: 0, top: '4px' }}>
      <IconBtn title="위로" onClick={onMoveUp}><polyline points="18 15 12 9 6 15"/></IconBtn>
      <IconBtn title="아래로" onClick={onMoveDown}><polyline points="6 9 12 15 18 9"/></IconBtn>
      <IconBtn title="삭제" onClick={onRemove} danger><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></IconBtn>
    </div>
  );

  return (
    <div style={{ position: 'relative', paddingRight: '92px' }}>
      {toolbar}

      {block.block_type === 'heading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select value={(c.level as number) ?? 2} onChange={e => onChange({ ...c, level: Number(e.target.value) })}
            style={{ height: '30px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '12px', color: '#6B7280', padding: '0 4px' }}>
            <option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option>
          </select>
          <input value={(c.text as string) ?? ''} onChange={e => onChange({ ...c, text: e.target.value })}
            placeholder="제목 텍스트"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: (c.level === 1 ? 24 : c.level === 3 ? 16 : 19) + 'px', fontWeight: 700, color: '#111827', fontFamily: 'inherit' }} />
        </div>
      )}

      {block.block_type === 'text' && (
        <textarea value={(c.markdown as string) ?? ''} onChange={e => onChange({ ...c, markdown: e.target.value })}
          placeholder="설명 텍스트를 입력하세요"
          rows={3}
          style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', lineHeight: 1.7, color: '#374151', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
      )}

      {block.block_type === 'video' && (
        <div>
          <input value={(c.url as string) ?? ''} onChange={e => onChange({ ...c, url: e.target.value })}
            placeholder="YouTube / Loom 영상 URL 붙여넣기"
            style={{ width: '100%', height: '38px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none' }} />
          {typeof c.url === 'string' && c.url && (
            <div style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '4px' }}>공개 페이지에서 영상으로 임베드됩니다.</div>
          )}
        </div>
      )}

      {block.block_type === 'tutorial' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px 14px', background: '#FAFAFA' }}>
          <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338CA" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📘 {tutorialTitle(c.tutorial_id as string)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#9CA3AF' }}>가이드 임베드 (접기/펼치기)</div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280', cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={!!c.default_open} onChange={e => onChange({ ...c, default_open: e.target.checked })} />
            기본 펼침
          </label>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: 'white', color: danger ? '#DC2626' : '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </button>
  );
}

// ── 가이드 선택 모달 ──
function GuidePicker({ tutorials, onPick, onClose }: {
  tutorials: Tutorial[];
  onPick: (t: Tutorial) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = tutorials.filter(t => (t.title ?? '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', width: '480px', maxWidth: 'calc(100vw - 32px)', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>가이드 추가</div>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="가이드 검색…"
            style={{ width: '100%', height: '38px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>가이드가 없습니다.</div>
          ) : filtered.map(t => (
            <button key={t.id} onClick={() => onPick(t)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontSize: '15px' }}>📘</span>
              <span style={{ flex: 1, fontSize: '13.5px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || '제목 없음'}</span>
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{(t as Tutorial & { step_count?: number }).step_count ?? ''}{(t as Tutorial & { step_count?: number }).step_count != null ? '단계' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
