'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RecordingModal } from '@/components/dashboard/RecordingModal';
import { AgentChat } from '@/components/chat/AgentChat';
import { createTutorial } from '@/lib/api/tutorials';
import { logError } from '@/lib/logging/logger';
import type { Tutorial, Workspace, Folder } from '@/types';


const CARD_COLORS = ['#3730a3', '#6d28d9', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444'];
function cardColor(id: string) { return CARD_COLORS[id.charCodeAt(0) % CARD_COLORS.length]; }

function getDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

// ── 폴더 → 워크스페이스 이동 버튼 ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FolderWsButton({ folderId, workspaces, onMove }: {
  folderId: string;
  workspaces: Workspace[];
  onMove: (folderId: string, workspaceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        title="팀 워크스페이스로 이동"
        style={{ width: '20px', height: '20px', borderRadius: '5px', border: 'none', background: 'transparent', color: '#D1D5DB', cursor: 'pointer', display: 'grid', placeItems: 'center', opacity: 0, transition: 'opacity 0.12s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#3730a3'; (e.currentTarget as HTMLButtonElement).style.background = '#e0e7ff'; }}
        onMouseLeave={e => { if (!open) { (e.currentTarget as HTMLButtonElement).style.opacity = '0'; (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; } }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', left: '100%', top: 0, marginLeft: '4px', zIndex: 200,
          background: 'white', borderRadius: '10px', padding: '4px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
          minWidth: '150px',
        }}>
          <div style={{ padding: '4px 10px 6px', fontSize: '10.5px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            워크스페이스로 이동
          </div>
          {workspaces.map(ws => (
            <button key={ws.id}
              onClick={e => { e.stopPropagation(); onMove(folderId, ws.id); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 10px', border: 'none', background: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px', color: '#374151', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 컨텍스트 메뉴 ──────────────────────────────────────────

type CtxMenu = { x: number; y: number; tutorialId: string } | null;

function ContextMenu({ menu, folders, tutorials, workspaces, onMove, onMoveToWorkspace, onDelete, onClose }: {
  menu: NonNullable<CtxMenu>;
  folders: Folder[];
  tutorials: Tutorial[];
  workspaces: Workspace[];
  onMove: (tutorialId: string, folderId: string | null) => void;
  onMoveToWorkspace: (tutorialId: string, workspaceId: string | null) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tutorial = tutorials.find(t => t.id === menu.tutorialId);
  const [showFolderSub, setShowFolderSub] = useState(false);
  const [showWsSub, setShowWsSub] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler); };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: 'fixed', left: menu.x, top: menu.y, zIndex: 1000,
    background: 'white', borderRadius: '10px', padding: '4px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
    minWidth: '160px', userSelect: 'none',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
    padding: '7px 10px', border: 'none', background: 'none', borderRadius: '7px',
    cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left',
  };

  return (
    <div ref={ref} style={menuStyle}>
      {/* 폴더로 이동 */}
      <div style={{ position: 'relative' }}
        onMouseEnter={() => setShowFolderSub(true)}
        onMouseLeave={() => setShowFolderSub(false)}>
        <button style={{ ...itemStyle, justifyContent: 'space-between' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            폴더로 이동
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        {showFolderSub && (
          <div style={{
            position: 'absolute', left: '100%', top: 0, marginLeft: '4px',
            background: 'white', borderRadius: '10px', padding: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
            minWidth: '160px',
          }}>
            <button
              style={{ ...itemStyle, color: !tutorial?.folder_id ? '#3730a3' : '#374151', fontWeight: !tutorial?.folder_id ? 600 : 400 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              onClick={() => { onMove(menu.tutorialId, null); onClose(); }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              미분류
              {!tutorial?.folder_id && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            {folders.length > 0 && <div style={{ height: '1px', background: '#F3F4F6', margin: '2px 6px' }} />}
            {folders.map(f => (
              <button key={f.id}
                style={{ ...itemStyle, color: tutorial?.folder_id === f.id ? f.color : '#374151', fontWeight: tutorial?.folder_id === f.id ? 600 : 400 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                onClick={() => { onMove(menu.tutorialId, f.id); onClose(); }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: f.color, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
                {tutorial?.folder_id === f.id && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 팀으로 이동 */}
      {workspaces.length > 0 && (
        <div style={{ position: 'relative' }}
          onMouseEnter={() => setShowWsSub(true)}
          onMouseLeave={() => setShowWsSub(false)}>
          <button style={{ ...itemStyle, justifyContent: 'space-between' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              팀으로 이동
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          {showWsSub && (
            <div style={{
              position: 'absolute', left: '100%', top: 0, marginLeft: '4px',
              background: 'white', borderRadius: '10px', padding: '4px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
              minWidth: '160px',
            }}>
              {tutorial?.workspace_id && (
                <>
                  <button
                    style={{ ...itemStyle, color: '#6B7280', fontSize: '12px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    onClick={() => { onMoveToWorkspace(menu.tutorialId, null); onClose(); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    개인으로 이동
                  </button>
                  <div style={{ height: '1px', background: '#F3F4F6', margin: '2px 6px' }} />
                </>
              )}
              {workspaces.map(ws => (
                <button key={ws.id}
                  style={{ ...itemStyle, color: tutorial?.workspace_id === ws.id ? '#3730a3' : '#374151', fontWeight: tutorial?.workspace_id === ws.id ? 600 : 400 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  onClick={() => { onMoveToWorkspace(menu.tutorialId, ws.id); onClose(); }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ws.name}</span>
                  {tutorial?.workspace_id === ws.id && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ height: '1px', background: '#F3F4F6', margin: '2px 4px' }} />

      {/* 삭제 */}
      <button
        style={{ ...itemStyle, color: '#EF4444' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={() => { if (confirm('이 매뉴얼을 삭제할까요?')) { onDelete(menu.tutorialId); onClose(); } }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        삭제
      </button>
    </div>
  );
}

// ── 플레이북 카드 ──────────────────────────────────────────

function PageCard({ page, viewMode = 'grid' }: {
  page: { id: string; title: string; updated_at: string; block_count?: number; workspace_id?: string | null };
  viewMode?: 'grid' | 'list' | 'compact';
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const color = cardColor(page.id);
  const dateStr = new Date(page.updated_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\. /g, '/').replace(/\.$/, '');

  const iconEl = (size: number) => (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '7px', flexShrink: 0, background: `${color}12`, display: 'grid', placeItems: 'center' }}>
      <svg width={size * 0.47} height={size * 0.47} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    </div>
  );

  const metaEl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
      <span style={{ fontSize: '12px', color: '#111827', flexShrink: 0 }}>{dateStr}</span>
      {(page.block_count ?? 0) > 0 && (
        <><span style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#D1D5DB', flexShrink: 0 }} /><span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>{page.block_count}블록</span></>
      )}
      {page.workspace_id && <span style={{ fontSize: '10px', fontWeight: 600, color: '#3730a3', background: '#e0e7ff', padding: '1px 5px', borderRadius: '999px', flexShrink: 0 }}>팀</span>}
    </div>
  );

  const titleEl = (
    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {page.title || '제목 없음'}
    </div>
  );

  const commonProps = {
    onClick: () => router.push(`/pages/${page.id}/editor`),
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (viewMode === 'compact') {
    return (
      <article {...commonProps} style={{ background: 'white', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${hovered ? '#86efac' : '#E5E7EB'}`, boxShadow: hovered ? '0 4px 16px rgba(5,150,105,0.10)' : '0 1px 2px rgba(17,24,39,0.04)', transition: 'border-color 0.12s, box-shadow 0.12s', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ width: '100%', aspectRatio: '16 / 10', background: `${color}10`, display: 'grid', placeItems: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.5 }}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 12px' }}>
          {iconEl(28)}
          <div style={{ flex: 1, minWidth: 0 }}>{titleEl}{metaEl}</div>
        </div>
      </article>
    );
  }

  return (
    <article {...commonProps} style={{ background: 'white', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${hovered ? '#86efac' : '#E5E7EB'}`, boxShadow: hovered ? '0 3px 12px rgba(5,150,105,0.07)' : '0 1px 2px rgba(17,24,39,0.04)', transition: 'border-color 0.12s, box-shadow 0.12s', display: 'flex', alignItems: 'center', gap: '11px', padding: viewMode === 'list' ? '10px 14px' : '11px 13px' }}>
      {iconEl(viewMode === 'list' ? 30 : 34)}
      <div style={{ flex: 1, minWidth: 0 }}>{titleEl}{metaEl}</div>
    </article>
  );
}

// ── 튜토리얼 카드 ──────────────────────────────────────────

type ViewMode = 'grid' | 'list' | 'compact';

function TutorialCard({ tutorial, onContextMenu, onTitleChange, onMenuClick, viewMode = 'grid' }: {
  tutorial: Tutorial;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onMenuClick: (e: React.MouseEvent, id: string) => void;
  viewMode?: ViewMode;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(tutorial.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [faviconSrc, setFaviconSrc] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const color = cardColor(tutorial.id);
  const stepCount = tutorial.step_count ?? 0;
  const dateStr = new Date(tutorial.updated_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\. /g, '/').replace(/\.$/, '');
  const domain = getDomain(tutorial.first_page_url);
  // Google → DuckDuckGo fallback
  const googleFavicon = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null;
  const ddgFavicon = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
  const activeFavicon = faviconSrc ?? googleFavicon;

  const saveTitle = useCallback(async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === tutorial.title) { setEditingTitle(false); setTitleDraft(tutorial.title); return; }
    setSavingTitle(true);
    try {
      await fetch(`/api/tutorials/${tutorial.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      onTitleChange(tutorial.id, trimmed);
    } finally { setSavingTitle(false); setEditingTitle(false); }
  }, [titleDraft, tutorial.id, tutorial.title, onTitleChange]);

  useEffect(() => { if (editingTitle) titleInputRef.current?.focus(); }, [editingTitle]);

  const iconEl = (size: number) => (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '7px', flexShrink: 0, background: `${color}12`, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      {activeFavicon && !faviconError
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={activeFavicon} alt="" width={size * 0.47} height={size * 0.47} onError={() => {
            if (activeFavicon === googleFavicon && ddgFavicon) setFaviconSrc(ddgFavicon);
            else setFaviconError(true);
          }} style={{ width: `${size * 0.47}px`, height: `${size * 0.47}px`, objectFit: 'contain' }} />
        : <svg width={size * 0.41} height={size * 0.41} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
      }
    </div>
  );

  const menuBtn = (
    <button
      onClick={e => { e.stopPropagation(); onMenuClick(e, tutorial.id); }}
      style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: hovered ? '#F3F4F6' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', opacity: hovered ? 1 : 0, transition: 'opacity 0.1s' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
    </button>
  );

  const titleEl = (
    editingTitle ? (
      <input ref={titleInputRef} value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(tutorial.title); } }}
        onClick={e => e.stopPropagation()} disabled={savingTitle}
        style={{ fontSize: '14px', fontWeight: 600, color: '#111827', border: '1.5px solid #3730a3', borderRadius: '5px', padding: '1px 6px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
      />
    ) : (
      <div onClick={e => { e.stopPropagation(); setEditingTitle(true); }} title="클릭해서 제목 편집"
        style={{ fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}>
        {tutorial.title}
      </div>
    )
  );

  const metaEl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
      {domain && <span style={{ fontSize: '12px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{domain}</span>}
      {domain && <span style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#D1D5DB', flexShrink: 0 }} />}
      <span style={{ fontSize: '12px', color: '#111827', flexShrink: 0, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>{dateStr}</span>
      {stepCount > 0 && <><span style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#D1D5DB', flexShrink: 0 }} /><span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>{stepCount}단계</span></>}
      {tutorial.status === 'published' && <span style={{ fontSize: '10px', fontWeight: 600, color: '#16A34A', background: '#DCFCE7', padding: '1px 5px', borderRadius: '999px', flexShrink: 0 }}>공유</span>}
      {(tutorial as Tutorial & { workspace_id?: string | null }).workspace_id && (
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#3730a3', background: '#e0e7ff', padding: '1px 5px', borderRadius: '999px', flexShrink: 0 }}>팀</span>
      )}
    </div>
  );

  const commonArticleProps = {
    // 폴더 패널로 드래그해서 정리 (Scribe 스타일 DnD)
    draggable: !editingTitle,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/mimic-tutorial', tutorial.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onContextMenu(e, tutorial.id); },
    onClick: () => { if (!editingTitle) router.push(`/manual/${tutorial.id}`); },
  };

  if (viewMode === 'compact') {
    // 카드 뷰 — 첫 스텝 스크린샷을 섬네일로 표시
    return (
      <article {...commonArticleProps} style={{
        background: 'white', borderRadius: '12px', cursor: 'pointer',
        border: `1px solid ${hovered ? '#a5b4fc' : '#E5E7EB'}`,
        boxShadow: hovered ? '0 4px 16px rgba(55,48,163,0.10)' : '0 1px 2px rgba(17,24,39,0.04)',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: `${color}10`, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
          {tutorial.thumbnail_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={tutorial.thumbnail_url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>}
          {tutorial.status === 'published' && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: '10px', fontWeight: 600, color: '#16A34A', background: '#DCFCE7', padding: '1px 6px', borderRadius: '999px' }}>공유</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 12px' }}>
          {iconEl(28)}
          <div style={{ flex: 1, minWidth: 0 }}>
            {titleEl}
            {metaEl}
          </div>
          {menuBtn}
        </div>
      </article>
    );
  }

  if (viewMode === 'list') {
    return (
      <article {...commonArticleProps} style={{
        background: 'white', borderRadius: '10px', cursor: 'pointer',
        border: `1px solid ${hovered ? '#a5b4fc' : '#E5E7EB'}`,
        boxShadow: hovered ? '0 2px 10px rgba(55,48,163,0.07)' : '0 1px 2px rgba(17,24,39,0.03)',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
      }}>
        {iconEl(30)}
        <div style={{ flex: 1, minWidth: 0 }}>
          {titleEl}
          {metaEl}
        </div>
        {menuBtn}
      </article>
    );
  }

  return (
    <article {...commonArticleProps} style={{
      background: 'white', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${hovered ? '#a5b4fc' : '#E5E7EB'}`,
      boxShadow: hovered ? '0 3px 12px rgba(55,48,163,0.07)' : '0 1px 2px rgba(17,24,39,0.04)',
      transition: 'border-color 0.12s, box-shadow 0.12s',
      display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 13px',
    }}>
      {iconEl(34)}
      <div style={{ flex: 1, minWidth: 0 }}>
        {titleEl}
        {metaEl}
      </div>
      {menuBtn}
    </article>
  );
}

// ── 빈 상태 ───────────────────────────────────────────────

function EmptyState({ onRecord, onBlank, onGuidebook, label }: { onRecord: () => void; onBlank: () => void; onGuidebook?: () => void; label?: string }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ margin: '0 auto 16px', width: '56px', height: '56px', borderRadius: '14px', background: '#e0e7ff', display: 'grid', placeItems: 'center', color: '#3730a3' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>{label ?? '매뉴얼이 없어요'}</div>
      <div style={{ fontSize: '12.5px', color: '#9CA3AF', marginBottom: '20px' }}>화면을 녹화하거나 직접 만들어보세요.</div>
      <div style={{ display: 'inline-flex', gap: '8px' }}>
        <button onClick={onRecord} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', border: 'none', cursor: 'pointer' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: 'recPulse 1.4s ease-in-out infinite' }} />
          화면 녹화
        </button>
        <button onClick={onBlank} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'white', color: '#3730a3', border: '1.5px solid #a5b4fc', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          직접 편집
        </button>
        {onGuidebook && (
          <button onClick={onGuidebook} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'white', color: '#059669', border: '1.5px solid #86efac', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            새 플레이북
          </button>
        )}
      </div>
    </div>
  );
}

// ── 폴더 슬라이드 패널 (Scribe 스타일) ─────────────────────

const FOLDER_COLORS = ['#3730a3', '#6d28d9', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6B7280'];

function FolderPanel({ folders, tutorials, activeFolder, active, title, onSelectFolder, onClose, onCreate, onRename, onChangeColor, onDelete, onDropTutorial }: {
  folders: Folder[];
  tutorials: Tutorial[];
  activeFolder: string | null | 'all';
  active: boolean;
  title: string;
  onSelectFolder: (id: string | null | 'all') => void;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onDropTutorial: (tutorialId: string, folderId: string | null) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null); // 'unfiled' | folderId
  const menuRef = useRef<HTMLDivElement>(null);

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 케밥 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!menuId) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuId]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try { await onCreate(name); setNewName(''); setShowInput(false); } finally { setCreating(false); }
  };

  const commitRename = (id: string) => {
    const name = editName.trim();
    if (name) onRename(id, name);
    setEditingId(null);
  };

  // 드롭 타깃 공통 핸들러 (미분류 = null)
  const dropProps = (key: string, folderId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('text/mimic-tutorial')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverKey !== key) setDragOverKey(key);
      }
    },
    onDragLeave: () => setDragOverKey(k => (k === key ? null : k)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const tid = e.dataTransfer.getData('text/mimic-tutorial');
      if (tid) onDropTutorial(tid, folderId);
      setDragOverKey(null);
    },
  });

  const unfiledCount = tutorials.filter(t => !t.folder_id).length;
  const isActive = (id: string | null | 'all') => active && activeFolder === id;

  const rowStyle = (active: boolean, dragOver: boolean, color = '#3730a3'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0,
    padding: '7px 9px', borderRadius: '7px', border: 'none', cursor: 'pointer',
    fontSize: '13px', textAlign: 'left',
    background: dragOver ? '#EEF2FF' : active ? `${color}14` : 'transparent',
    boxShadow: dragOver ? 'inset 0 0 0 1.5px #6366F1' : 'none',
    color: active ? color : '#374151',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div className="home-folder-panel" style={{
      // 그리드 컬럼으로 메인 콘텐츠를 밀어냄 (오버레이 시 카드가 가려져 DnD 불가)
      position: 'sticky', top: 0, height: '100vh', width: '264px',
      background: 'white', borderRight: '1px solid #E5E7EB',
      boxShadow: '12px 0 28px rgba(17,24,39,0.06)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'folderPanelIn 0.22s cubic-bezier(0.22,0.61,0.36,1)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 14px 12px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#3730a3', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </div>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <button onClick={onClose} title="패널 닫기 (Esc)"
          style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#4B5563'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>

      {/* 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 4px' }}>
        {/* 전체 / 미분류 — 좌우 나란히 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
          <button onClick={() => onSelectFolder('all')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', padding: '7px 9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12.5px', textAlign: 'left', background: isActive('all') ? '#3730a314' : '#F9FAFB', color: isActive('all') ? '#3730a3' : '#374151', fontWeight: isActive('all') ? 600 : 400 }}
            onMouseEnter={e => { if (!isActive('all')) (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}
            onMouseLeave={e => { if (!isActive('all')) (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'; }}>
            <span>전체</span>
            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>{tutorials.length}</span>
          </button>
          <div {...dropProps('unfiled', null)} style={{ display: 'contents' }}>
            <button onClick={() => onSelectFolder(null)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', padding: '7px 9px', borderRadius: '7px', border: dragOverKey === 'unfiled' ? '1.5px solid #6366F1' : 'none', cursor: 'pointer', fontSize: '12.5px', textAlign: 'left', background: dragOverKey === 'unfiled' ? '#EEF2FF' : isActive(null) ? '#6B728014' : '#F9FAFB', color: isActive(null) ? '#6B7280' : '#374151', fontWeight: isActive(null) ? 600 : 400 }}
              onMouseEnter={e => { if (!isActive(null) && dragOverKey !== 'unfiled') (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}
              onMouseLeave={e => { if (!isActive(null) && dragOverKey !== 'unfiled') (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'; }}>
              <span>미분류</span>
              <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>{unfiledCount}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 9px 6px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>폴더</span>
          <span style={{ fontSize: '10.5px', color: '#D1D5DB' }}>{folders.length}</span>
          <div style={{ flex: 1, height: '1px', background: '#F3F4F6' }} />
        </div>

        {folders.length === 0 && (
          <div style={{ padding: '10px 9px', fontSize: '12px', color: '#9CA3AF', lineHeight: 1.6 }}>
            아직 폴더가 없어요.
          </div>
        )}

        {folders.map(f => (
          <div key={f.id} {...dropProps(f.id, f.id)} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '1px' }}>
            {editingId === f.id ? (
              <input autoFocus value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => commitRename(f.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(f.id);
                  if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); }
                }}
                style={{ flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: '7px', border: '1.5px solid #3730a3', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
            ) : (
              <>
                <button onClick={() => onSelectFolder(f.id)}
                  onDoubleClick={() => { setEditingId(f.id); setEditName(f.name); }}
                  title={`${f.name} — 더블클릭으로 이름 변경`}
                  style={rowStyle(isActive(f.id), dragOverKey === f.id, f.color)}
                  onMouseEnter={e => { if (!isActive(f.id) && dragOverKey !== f.id) e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={e => { if (!isActive(f.id) && dragOverKey !== f.id) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ width: '13px', height: '13px', borderRadius: '4px', background: f.color, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{tutorials.filter(t => t.folder_id === f.id).length}</span>
                </button>
                <button onClick={e => { e.stopPropagation(); setMenuId(menuId === f.id ? null : f.id); }}
                  title="폴더 옵션"
                  style={{ width: '22px', height: '22px', borderRadius: '5px', border: 'none', background: menuId === f.id ? '#F3F4F6' : 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#4B5563'; }}
                  onMouseLeave={e => { if (menuId !== f.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; } }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                </button>

                {/* 폴더 옵션 메뉴: 이름 변경 / 색상 / 삭제 */}
                {menuId === f.id && (
                  <div ref={menuRef} style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 60,
                    background: 'white', borderRadius: '10px', padding: '5px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
                    minWidth: '168px',
                  }}>
                    <button onClick={() => { setMenuId(null); setEditingId(f.id); setEditName(f.name); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 9px', border: 'none', background: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#374151', textAlign: 'left' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                      이름 변경
                    </button>
                    <div style={{ padding: '7px 9px 4px', fontSize: '10.5px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.04em' }}>색상</div>
                    <div style={{ display: 'flex', gap: '5px', padding: '0 9px 7px', flexWrap: 'wrap' }}>
                      {FOLDER_COLORS.map(c => (
                        <button key={c} onClick={() => { onChangeColor(f.id, c); setMenuId(null); }}
                          style={{ width: '17px', height: '17px', borderRadius: '50%', background: c, border: f.color === c ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                      ))}
                    </div>
                    <div style={{ height: '1px', background: '#F3F4F6', margin: '2px 5px' }} />
                    <button onClick={() => { setMenuId(null); onDelete(f.id); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 9px', border: 'none', background: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', color: '#EF4444', textAlign: 'left' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      삭제
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* 새 폴더 — 하단 */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
        {showInput ? (
          <form onSubmit={submitCreate} style={{ display: 'flex', gap: '5px' }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="폴더 이름"
              onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setShowInput(false); setNewName(''); } }}
              onBlur={() => { if (!creating) { setShowInput(false); setNewName(''); } }}
              style={{ flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: '7px', border: '1.5px solid #a5b4fc', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
            <button type="submit" disabled={creating || !newName.trim()}
              onMouseDown={e => e.preventDefault()}
              style={{ padding: '0 11px', borderRadius: '7px', background: '#3730a3', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: creating || !newName.trim() ? 0.6 : 1 }}>
              {creating ? '...' : '추가'}
            </button>
          </form>
        ) : (
          <button onClick={() => { setShowInput(true); setNewName(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '7px 9px', borderRadius: '7px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12.5px', color: '#9CA3AF' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLButtonElement).style.color = '#4338CA'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            새 폴더 추가
          </button>
        )}
      </div>
      <div style={{ padding: '6px 14px 10px', fontSize: '11px', color: '#C4C9D4', lineHeight: 1.5, flexShrink: 0 }}>
        카드를 폴더로 드래그해서 정리
      </div>
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [tutLoading, setTutLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [teamFolders, setTeamFolders] = useState<Folder[]>([]); // 활성 워크스페이스의 공유 폴더
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [activeFolder, setActiveFolder] = useState<string | null | 'all'>('all');
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);

  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [creating, setCreating] = useState(false);

  // 워크스페이스 생성
  const [showNewWsInput, setShowNewWsInput] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);

  // 폴더 슬라이드 패널 (내 워크스페이스 클릭 시 열림)
  const [showFolderPanel, setShowFolderPanel] = useState(false);

  // 사이드바 섹션 접기/펼치기 (모바일 드로어용)
  const [myOpen, setMyOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);

  // 컨텍스트 메뉴
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);

  // 모바일 드로어
  const [showDrawer, setShowDrawer] = useState(false);

  // 뷰 모드
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // 공지 배너
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const NOTICE = { type: 'info' as 'info' | 'warn' | 'error', text: '✨ AI 자동 어노테이션 기능이 업데이트되었습니다. 지금 바로 사용해보세요!', link: { label: '자세히 보기', href: '/home' } };

  const newMenuRef = useRef<HTMLDivElement>(null);
  const [liveGuide, setLiveGuide] = useState<{ used: number; limit: number; paid: boolean } | null>(null);
  const [playbook, setPlaybook] = useState<{ used: number; limit: number; paid: boolean } | null>(null);

  // 콘텐츠 유형 탭
  const [contentType, setContentType] = useState<'manual' | 'practice' | 'playbook' | 'liveguide'>('manual');
  const [pages, setPages] = useState<{ id: string; title: string; updated_at: string; block_count?: number; workspace_id?: string | null }[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);

  const loadTutorials = useCallback(async (workspaceId?: string, silent = false) => {
    if (!silent) setTutLoading(true);
    try {
      const url = workspaceId ? `/api/tutorials?workspace_id=${workspaceId}` : '/api/tutorials';
      const res = await fetch(url);
      if (res.ok) setTutorials(await res.json());
    } finally { if (!silent) setTutLoading(false); }
  }, []);

  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/folders');
    if (res.ok) setFolders(await res.json());
  }, []);

  const loadTeamFolders = useCallback(async (workspaceId: string) => {
    const res = await fetch(`/api/folders?workspace_id=${workspaceId}`);
    if (res.ok) setTeamFolders(await res.json());
    else setTeamFolders([]);
  }, []);

  const loadWorkspaces = useCallback(async () => {
    const res = await fetch('/api/workspaces');
    if (res.ok) setWorkspaces(await res.json());
  }, []);

  const loadPages = useCallback(async (workspaceId?: string) => {
    setPagesLoading(true);
    try {
      const url = workspaceId ? `/api/pages?workspace_id=${workspaceId}` : '/api/pages';
      const res = await fetch(url);
      if (res.ok) setPages(await res.json());
    } finally { setPagesLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadTutorials();
    loadFolders();
    loadWorkspaces();
    // 라이브 가이드·플레이북 사용량 — 홈 '이번 달 사용량'에 함께 표시
    fetch('/api/user/plan')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.liveGuide) setLiveGuide({ used: d.liveGuide.used ?? 0, limit: d.liveGuide.limit ?? 5, paid: !!d.paid });
        if (d?.playbook) setPlaybook({ used: d.playbook.used ?? 0, limit: d.playbook.limit ?? 3, paid: !!d.paid });
      })
      .catch(() => {});
  }, [user, loadTutorials, loadFolders, loadWorkspaces]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'team' && activeWorkspace) { loadTutorials(activeWorkspace); loadTeamFolders(activeWorkspace); }
    else if (activeTab === 'my') loadTutorials();
  }, [activeTab, activeWorkspace, user, loadTutorials, loadTeamFolders]);

  useEffect(() => {
    if (!user || contentType !== 'playbook') return;
    const wsId = activeTab === 'team' && activeWorkspace ? activeWorkspace : undefined;
    loadPages(wsId);
  }, [user, contentType, activeTab, activeWorkspace, loadPages]);

  // 초대받은 워크스페이스가 내 화면에도 항시 반영되도록 — 포커스/가시성 복귀 + 30초 폴링으로
  // 워크스페이스 목록과 현재 탭 매뉴얼을 갱신(push 실시간 대신 폴링 기반).
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      loadWorkspaces();
      if (activeTab === 'team' && activeWorkspace) { loadTutorials(activeWorkspace, true); loadTeamFolders(activeWorkspace); }
      else loadTutorials(undefined, true);
    };
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    const id = setInterval(refresh, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', refresh);
      clearInterval(id);
    };
  }, [user, activeTab, activeWorkspace, loadWorkspaces, loadTutorials, loadTeamFolders]);

  useEffect(() => {
    if (!showNewMenu) return;
    const handler = (e: MouseEvent) => { if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setShowNewMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewMenu]);

  const usedToday = user?.daily_manual_count ?? 0;
  const dailyLimit = user?.daily_limit ?? 3;
  const isPro = user?.plan === 'pro' || user?.plan === 'team';
  const firstName = user?.name?.split(' ')[0] ?? '';

  const handleSignOut = async () => { await signOut(); router.push('/auth/login'); };

  const handleCreateBlank = async () => {
    setShowNewMenu(false); setCreating(true);
    try {
      // 팀 탭에서 워크스페이스가 선택돼 있으면 팀 매뉴얼로 생성
      const wsId = activeTab === 'team' && activeWorkspace ? activeWorkspace : null;
      const tutorial = await createTutorial(wsId ? { workspace_id: wsId } : undefined);
      router.push(`/manual/${tutorial.id}/editor`);
    } catch { alert('생성 중 오류가 발생했습니다.'); setCreating(false); }
  };

  const handleCreateGuidebook = async () => {
    setShowNewMenu(false); setCreating(true);
    try {
      const wsId = activeTab === 'team' && activeWorkspace ? activeWorkspace : null;
      const res = await fetch('/api/pages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wsId ? { workspace_id: wsId } : {}),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        alert(typeof e?.error === 'string' ? e.error : '생성 중 오류가 발생했습니다.');
        setCreating(false);
        return;
      }
      const page = await res.json();
      router.push(`/pages/${page.id}/editor`);
    } catch { alert('생성 중 오류가 발생했습니다.'); setCreating(false); }
  };

  const handleRemove = async (id: string) => {
    await fetch(`/api/tutorials/${id}`, { method: 'DELETE' });
    setTutorials(prev => prev.filter(t => t.id !== id));
  };

  const handleTitleChange = (id: string, title: string) => {
    setTutorials(prev => prev.map(t => t.id === id ? { ...t, title } : t));
  };

  const handleMoveToFolder = async (tutorialId: string, folderId: string | null) => {
    const res = await fetch(`/api/tutorials/${tutorialId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    });
    if (!res.ok) { logError('tutorial.moveFolder.fail', { tutorialId, folderId, status: res.status }); return; }
    setTutorials(prev => prev.map(t => t.id === tutorialId ? { ...t, folder_id: folderId } : t));
  };

  // 폴더 컨텍스트 — 팀 탭이면 활성 워크스페이스의 공유 폴더, 아니면 개인 폴더
  const isTeamCtx = activeTab === 'team' && !!activeWorkspace;
  const panelFolders = isTeamCtx ? teamFolders : folders;
  const setPanelFolders = isTeamCtx ? setTeamFolders : setFolders;

  const handleCreateFolder = async (name: string) => {
    const res = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, workspace_id: isTeamCtx ? activeWorkspace : null }) });
    if (res.ok) { const folder = await res.json(); setPanelFolders(prev => [...prev, folder]); }
    else logError('folder.create.fail', { workspaceId: isTeamCtx ? activeWorkspace : null, status: res.status });
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('폴더를 삭제할까요? 안의 매뉴얼은 유지됩니다.')) return;
    const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    if (!res.ok) { logError('folder.delete.fail', { folderId: id, status: res.status }); return; }
    setPanelFolders(prev => prev.filter(f => f.id !== id));
    setTutorials(prev => prev.map(t => t.folder_id === id ? { ...t, folder_id: null } : t));
    if (activeFolder === id) setActiveFolder('all');
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const res = await fetch(`/api/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) { logError('folder.rename.fail', { folderId: id, status: res.status }); return; }
    setPanelFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  };

  const handleChangeFolderColor = async (id: string, color: string) => {
    const res = await fetch(`/api/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color }) });
    if (!res.ok) { logError('folder.color.fail', { folderId: id, status: res.status }); return; }
    setPanelFolders(prev => prev.map(f => f.id === id ? { ...f, color } : f));
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMoveFolderToWorkspace = async (folderId: string, workspaceId: string | null) => {
    // 해당 폴더의 모든 튜토리얼을 workspace_id로 이동 (null = 개인으로 복귀)
    const targets = tutorials.filter(t => t.folder_id === folderId);
    await Promise.all(targets.map(t =>
      fetch(`/api/tutorials/${t.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, folder_id: null }),
      })
    ));
    if (workspaceId) {
      // 워크스페이스 탭으로 전환
      setTutorials(prev => prev.filter(t => t.folder_id !== folderId));
      setActiveTab('team');
      setActiveWorkspace(workspaceId);
      await loadTutorials(workspaceId);
    } else {
      // 개인으로 복귀
      setTutorials(prev => prev.map(t => t.folder_id === folderId ? { ...t, workspace_id: null } : t));
    }
  };

  const handleMoveToWorkspace = async (tutorialId: string, workspaceId: string | null) => {
    await fetch(`/api/tutorials/${tutorialId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, folder_id: null }),
    });
    if (workspaceId) {
      setTutorials(prev => prev.filter(t => t.id !== tutorialId));
    } else {
      setTutorials(prev => prev.map(t => t.id === tutorialId ? { ...t, workspace_id: null } : t));
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setCreatingWs(true);
    try {
      const res = await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newWsName.trim() }) });
      if (res.ok) { const ws = await res.json(); setWorkspaces(prev => [ws, ...prev]); setNewWsName(''); setShowNewWsInput(false); }
    } finally { setCreatingWs(false); }
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    // 화면 경계 고려해서 메뉴 위치 계산
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setCtxMenu({ x, y, tutorialId: id });
  };

  const displayedTutorials = (() => {
    let list =
      activeFolder === 'all' ? tutorials :
      activeFolder === null ? tutorials.filter(t => !t.folder_id) :
      tutorials.filter(t => t.folder_id === activeFolder);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q));
    }
    return list;
  })();

  const practiceTutorials = displayedTutorials.filter(t => t.share_token);

  const displayedPages = (() => {
    if (!searchQuery.trim()) return pages;
    const q = searchQuery.trim().toLowerCase();
    return pages.filter(p => (p.title ?? '').toLowerCase().includes(q));
  })();

  // 폴더 트리 아이템 공통 스타일 헬퍼
  const folderItemActive = (id: string | null | 'all') => activeFolder === id && activeTab === 'my';

  return (
    <>
      {showRecordingModal && <RecordingModal onClose={() => setShowRecordingModal(false)} />}
      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          folders={panelFolders}
          tutorials={tutorials}
          workspaces={workspaces}
          onMove={handleMoveToFolder}
          onMoveToWorkspace={handleMoveToWorkspace}
          onDelete={handleRemove}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: "'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: '13.5px', color: 'var(--mm-text-1)', background: 'var(--mm-bg-soft)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: showFolderPanel ? '220px 264px minmax(0, 1fr)' : '220px minmax(0, 1fr)', flex: 1, minHeight: 0 }} className="home-layout-grid">

          {/* ── 사이드바 — 모바일에서 숨김 ── */}
          <aside className="home-sidebar" style={{ background: 'var(--mm-bg)', borderRight: '1px solid var(--mm-border-light)', padding: '16px 12px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>

            {/* 로고 */}
            <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 16px', textDecoration: 'none' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32" style={{ flexShrink: 0 }}><circle cx="50" cy="50" r="50" fill="#3730a3"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text></svg>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#3730a3', letterSpacing: '-0.03em' }}>MIMIC</span>
            </Link>

            {/* ── 워크스페이스 트리 ── */}
            <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>

              {/* ① 내 워크스페이스 (클릭 = 폴더 패널 슬라이드 오픈) */}
              <button onClick={() => { if (activeTab !== 'my') { setActiveTab('my'); setActiveFolder('all'); setShowFolderPanel(true); } else { setShowFolderPanel(v => !v); } }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', background: showFolderPanel && activeTab === 'my' ? '#F3F4F6' : 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = showFolderPanel ? '#F3F4F6' : 'transparent')}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: activeTab === 'my' ? '#3730a3' : '#E5E7EB', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', flex: 1 }}>내 워크스페이스</span>
                {/* 활성 폴더 색 표시 */}
                {activeTab === 'my' && activeFolder !== 'all' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeFolder === null ? '#9CA3AF' : (folders.find(f => f.id === activeFolder)?.color ?? '#3730a3'), flexShrink: 0 }} />
                )}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: showFolderPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              {/* ② 팀 워크스페이스 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1px', marginTop: '4px' }}>
                <button onClick={() => setTeamOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, padding: '7px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: activeTab === 'team' ? '#3730a3' : '#E5E7EB', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', flex: 1 }}>팀 워크스페이스</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
                    style={{ transform: teamOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <button onClick={() => { setShowNewWsInput(v => !v); setNewWsName(''); setTeamOpen(true); }}
                  style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center', borderRadius: '6px', flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLButtonElement).style.color = '#4B5563'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}
                  title="새 워크스페이스">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>

              {/* ② 팀 워크스페이스 하위 */}
              {teamOpen && (
                <div style={{ paddingLeft: '12px', marginLeft: '19px', borderLeft: '2px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '2px' }}>
                  {showNewWsInput && (
                    <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', gap: '4px', paddingBottom: '4px' }}>
                      <input autoFocus value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="워크스페이스 이름"
                        onBlur={() => { if (!creatingWs) { setShowNewWsInput(false); setNewWsName(''); } }}
                        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setShowNewWsInput(false); setNewWsName(''); } }}
                        style={{ flex: 1, padding: '4px 7px', borderRadius: '6px', border: '1px solid #a5b4fc', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                      <button type="submit" disabled={creatingWs || !newWsName.trim()}
                        onMouseDown={e => e.preventDefault()}
                        style={{ padding: '4px 8px', borderRadius: '6px', background: '#3730a3', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        {creatingWs ? '...' : '만들기'}
                      </button>
                    </form>
                  )}
                  {workspaces.length === 0
                    ? <div style={{ padding: '4px 8px', fontSize: '13px', color: '#D1D5DB' }}>없음</div>
                    : workspaces.map(ws => (
                      <div key={ws.id} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                        <button onClick={() => { const switching = !(activeTab === 'team' && activeWorkspace === ws.id); setActiveTab('team'); setActiveWorkspace(ws.id); if (switching) setActiveFolder('all'); setShowFolderPanel(true); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left', background: activeTab === 'team' && activeWorkspace === ws.id ? '#e0e7ff' : 'transparent', color: activeTab === 'team' && activeWorkspace === ws.id ? '#3730a3' : '#4B5563', fontWeight: activeTab === 'team' && activeWorkspace === ws.id ? 600 : 400 }}
                          onMouseEnter={e => { if (!(activeTab === 'team' && activeWorkspace === ws.id)) (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}
                          onMouseLeave={e => { if (!(activeTab === 'team' && activeWorkspace === ws.id)) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{ws.member_count ?? 0}명</span>
                        </button>
                        <Link href={`/workspace/${ws.id}`} onClick={e => e.stopPropagation()}
                          style={{ width: '20px', height: '20px', borderRadius: '4px', display: 'grid', placeItems: 'center', color: '#9CA3AF', textDecoration: 'none', flexShrink: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLAnchorElement).style.color = '#4B5563'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF'; }}
                          title="멤버 관리">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1v.09a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1-.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-.09V4.5a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 .09 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 .09 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-.09 1z"/></svg>
                        </Link>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* 사용량 */}
            {!authLoading && (
              <div style={{ marginTop: 'auto', padding: '12px 10px', borderRadius: '10px', background: '#F9FAFB', border: '1px solid #F3F4F6', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '8px', fontWeight: 500 }}>이번 달 사용량</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPro ? 0 : '6px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>매뉴얼</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                    {usedToday}{isPro ? '' : ` / ${dailyLimit}`}
                    {isPro && <span style={{ fontSize: '10px', color: '#10B981', marginLeft: '4px', fontWeight: 500 }}>무제한</span>}
                  </span>
                </div>
                {!isPro && (
                  <div style={{ height: '4px', borderRadius: '999px', background: '#E5E7EB', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: usedToday >= dailyLimit ? '#EF4444' : '#3730a3', width: `${Math.min(100, (usedToday / dailyLimit) * 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                )}
                {/* 라이브 가이드 사용량 */}
                {liveGuide && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>라이브 가이드</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                      {liveGuide.paid
                        ? <>{liveGuide.used}<span style={{ fontSize: '10px', color: '#10B981', marginLeft: '4px', fontWeight: 500 }}>무제한</span></>
                        : `${liveGuide.used} / ${liveGuide.limit}`}
                    </span>
                  </div>
                )}
                {!isPro && liveGuide && !liveGuide.paid && (
                  <div style={{ height: '4px', borderRadius: '999px', background: '#E5E7EB', overflow: 'hidden', marginTop: '6px' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: liveGuide.used >= liveGuide.limit ? '#EF4444' : '#7c3aed', width: `${Math.min(100, (liveGuide.used / liveGuide.limit) * 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                )}
                {/* 플레이북 사용량 (Free: N/한도, Pro: 무제한) */}
                {playbook && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>플레이북</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                      {playbook.paid
                        ? <>{playbook.used}<span style={{ fontSize: '10px', color: '#10B981', marginLeft: '4px', fontWeight: 500 }}>무제한</span></>
                        : `${playbook.used} / ${playbook.limit}`}
                    </span>
                  </div>
                )}
                {!isPro && playbook && !playbook.paid && (
                  <div style={{ height: '4px', borderRadius: '999px', background: '#E5E7EB', overflow: 'hidden', marginTop: '6px' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: playbook.used >= playbook.limit ? '#EF4444' : '#0EA5E9', width: `${Math.min(100, (playbook.used / playbook.limit) * 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                )}
                {!isPro && <Link href="/settings" style={{ display: 'block', marginTop: '10px', padding: '6px', borderRadius: '7px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '11.5px', fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>Pro로 업그레이드</Link>}
              </div>
            )}

            {/* 유저 */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* 마이페이지 */}
              <Link href="/mypage"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', color: '#4B5563' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                마이페이지
              </Link>
              {/* 설정 */}
              <Link href="/settings"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', color: '#4B5563' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                설정
              </Link>
              {/* 휴지통 */}
              <Link href="/trash"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', color: '#4B5563' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                휴지통
              </Link>
              {/* 도움말 */}
              <Link href="/help"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', color: '#4B5563' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                도움말
              </Link>
              {/* 사용자 배지 — 클릭 시 마이페이지 이동 */}
              <Link href="/mypage"
                style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', color: '#374151', textDecoration: 'none', marginTop: '2px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {user?.avatar_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={user.avatar_url} alt={user.name} style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                  : <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{authLoading ? '·' : firstName.charAt(0) || '?'}</div>
                }
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authLoading ? '...' : (user?.name ?? '내 계정')}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{user?.plan === 'free' ? '무료 플랜' : user?.plan === 'team' ? 'Team' : 'Pro'}</div>
                </div>
              </Link>
              <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                로그아웃
              </button>
            </div>
          </aside>

          {/* ── 폴더 슬라이드 패널 ── */}
          {showFolderPanel && (
            <FolderPanel
              folders={panelFolders}
              tutorials={tutorials}
              activeFolder={activeFolder}
              active={true}
              title={isTeamCtx ? (workspaces.find(w => w.id === activeWorkspace)?.name ?? '팀 워크스페이스') : '내 워크스페이스'}
              onSelectFolder={id => setActiveFolder(id)}
              onClose={() => setShowFolderPanel(false)}
              onCreate={handleCreateFolder}
              onRename={handleRenameFolder}
              onChangeColor={handleChangeFolderColor}
              onDelete={handleDeleteFolder}
              onDropTutorial={handleMoveToFolder}
            />
          )}

          {/* ── 메인 ── */}
          <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
            {/* 공지 배너 */}
            {!noticeDismissed && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 16px',
                background: NOTICE.type === 'error' ? 'linear-gradient(90deg, #fef2f2, #fee2e2)' : NOTICE.type === 'warn' ? 'linear-gradient(90deg, #fffbeb, #fef3c7)' : 'linear-gradient(90deg, #eef2ff, #ede9fe)',
                borderBottom: `1px solid ${NOTICE.type === 'error' ? '#fca5a5' : NOTICE.type === 'warn' ? '#fcd34d' : '#c7d2fe'}`,
                flexShrink: 0, zIndex: 20,
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: NOTICE.type === 'error' ? '#ef4444' : NOTICE.type === 'warn' ? '#f59e0b' : '#3730a3', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '13px', color: NOTICE.type === 'error' ? '#991b1b' : NOTICE.type === 'warn' ? '#92400e' : '#3730a3', fontWeight: 500 }}>
                  {NOTICE.text}
                </span>
                {NOTICE.link && (
                  <a href={NOTICE.link.href} style={{ fontSize: '12px', fontWeight: 700, color: NOTICE.type === 'error' ? '#b91c1c' : NOTICE.type === 'warn' ? '#b45309' : '#4338ca', textDecoration: 'underline', textUnderlineOffset: '2px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {NOTICE.link.label}
                  </a>
                )}
                <button onClick={() => setNoticeDismissed(true)} style={{ width: '20px', height: '20px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: NOTICE.type === 'error' ? '#b91c1c' : NOTICE.type === 'warn' ? '#b45309' : '#6366f1', flexShrink: 0, opacity: 0.7 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}
            {/* 헤더 — 모바일에서는 로고+버튼만 (PC에선 숨김, home-header 클래스로 제어) */}
            <header className="home-header" style={{ display: 'none', alignItems: 'center', gap: '12px', height: '60px', padding: '0 16px', background: 'var(--mm-bg)', borderBottom: '1px solid var(--mm-border-light)', position: 'sticky', top: 0, zIndex: 30, flexShrink: 0 }}>
              {/* 모바일 전용: 로고 (햄버거는 우측으로 이동) */}
              <div className="home-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="26" height="26"><circle cx="50" cy="50" r="50" fill="#3730a3"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text></svg>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#3730a3', letterSpacing: '-0.03em' }}>MIMIC</span>
                </Link>
              </div>
              {/* 모바일 전용: 햄버거 버튼 */}
              <button className="home-hamburger-btn"
                onClick={() => setShowDrawer(true)}
                style={{ display: 'none', width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', placeItems: 'center', cursor: 'pointer', color: '#374151', flexShrink: 0, marginLeft: 'auto' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            </header>

            {/* 본문 */}
            <div className="home-main-body" style={{ padding: '28px 32px', flex: 1, minHeight: 0 }}>
              {/* 인사말 + 새 매뉴얼 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <h1 className="home-greeting" style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.025em', margin: 0, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {authLoading ? '' : isTeamCtx
                      ? (workspaces.find(w => w.id === activeWorkspace)?.name ?? '팀 워크스페이스')
                      : contentType === 'playbook' ? `${firstName}님의 플레이북` : contentType === 'liveguide' ? 'Live Guide' : `${firstName}님의 매뉴얼`}
                  </h1>
                  {isTeamCtx && (
                    <>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#3730a3', background: '#e0e7ff', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>팀</span>
                      <Link href={`/workspace/${activeWorkspace}`} title="멤버 관리"
                        style={{ fontSize: '12.5px', color: '#6B7280', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        멤버 관리
                      </Link>
                    </>
                  )}
                </div>
                <div ref={newMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <button onClick={() => setShowNewMenu(v => !v)} disabled={creating}
                    className="home-new-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '9px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', fontSize: '13.5px', fontWeight: 600, boxShadow: '0 2px 8px rgba(55,48,163,0.28)', opacity: creating ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                    {creating
                      ? <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                      : <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.85)', animation: 'recPulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
                    }
                    새로 만들기
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: showNewMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showNewMenu && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: 'white', borderRadius: '12px', boxShadow: '0 8px 28px rgba(17,24,39,0.14), 0 0 0 1px rgba(0,0,0,0.06)', overflow: 'hidden', zIndex: 100 }}>
                      <button className="home-recording-btn" onClick={() => { setShowNewMenu(false); setShowRecordingModal(true); }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', padding: '13px 15px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#FEE2E2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="#EF4444"/></svg>
                        </span>
                        <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>새 매뉴얼(녹화)</div><div style={{ fontSize: '11.5px', color: '#6B7280' }}>클릭 동작을 자동 캡처</div></div>
                      </button>
                      <div className="home-recording-divider" style={{ height: '1px', background: '#F3F4F6', margin: '0 12px' }} />
                      <button onClick={handleCreateGuidebook}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', padding: '13px 15px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#dcfce7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        </span>
                        <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>새 플레이북(통합 문서)</div><div style={{ fontSize: '11.5px', color: '#6B7280' }}>여러 매뉴얼을 한 문서로</div></div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 콘텐츠 유형 탭 */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                {([
                  { key: 'manual' as const, label: '매뉴얼', color: '#3730a3', bg: '#e0e7ff', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
                  { key: 'practice' as const, label: '실습하기', color: '#0369a1', bg: '#e0f2fe', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg> },
                  { key: 'playbook' as const, label: '플레이북', color: '#059669', bg: '#dcfce7', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
                  { key: 'liveguide' as const, label: 'Live Guide', color: '#7c3aed', bg: '#ede9fe', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
                ] as const).map(({ key, label, color, bg, icon }) => (
                  <button key={key} onClick={() => setContentType(key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.12s, color 0.12s', background: contentType === key ? bg : '#F3F4F6', color: contentType === key ? color : '#6B7280', boxShadow: contentType === key ? `0 0 0 1.5px ${color}40` : 'none' }}
                    onMouseEnter={e => { if (contentType !== key) (e.currentTarget as HTMLButtonElement).style.background = '#E9EAEC'; }}
                    onMouseLeave={e => { if (contentType !== key) (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}>
                    {icon}{label}
                  </button>
                ))}
              </div>

              {/* 검색 */}
              <div
                className="home-search-bar"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', padding: '0 12px', border: `1.5px solid ${searchQuery ? '#4F46E5' : '#E5E7EB'}`, borderRadius: '9px', background: searchQuery ? '#F5F3FF' : 'white', color: '#9CA3AF', transition: 'border-color 0.15s, background 0.15s', boxShadow: searchQuery ? '0 0 0 3px rgba(79,70,229,0.10)' : 'none', marginBottom: '16px', maxWidth: '360px' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={searchQuery ? '#4F46E5' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  placeholder={contentType === 'playbook' ? '플레이북 이름으로 검색...' : contentType === 'liveguide' ? 'Live Guide 검색...' : contentType === 'practice' ? '실습하기 검색...' : '매뉴얼 이름으로 검색...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '14.5px', fontFamily: 'inherit', color: '#111827' }}
                  onFocus={e => { const p = e.currentTarget.parentElement!; p.style.borderColor = '#4F46E5'; p.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.10)'; }}
                  onBlur={e => { const p = e.currentTarget.parentElement!; if (!searchQuery) { p.style.borderColor = '#E5E7EB'; p.style.boxShadow = 'none'; } }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#9CA3AF', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>

              {/* 탭 + 뷰 토글 */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #F3F4F6' }}>
                <div style={{ flex: 1, padding: '7px 2px', fontSize: '13px', color: '#9CA3AF', fontWeight: 500 }}>
                  {contentType === 'playbook'
                    ? (!pagesLoading && `플레이북 ${displayedPages.length}개`)
                    : contentType === 'liveguide'
                      ? (!tutLoading && `Live Guide ${displayedTutorials.length}개`)
                      : contentType === 'practice'
                        ? (!tutLoading && `실습하기 ${practiceTutorials.length}개`)
                        : (!tutLoading && `매뉴얼 ${displayedTutorials.length}개`)}
                </div>
                {/* 뷰 모드 토글 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '6px', background: '#F3F4F6', borderRadius: '8px', padding: '3px' }}>
                  {([
                    { mode: 'grid' as ViewMode, title: '그리드', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
                    { mode: 'list' as ViewMode, title: '리스트', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg> },
                    { mode: 'compact' as ViewMode, title: '카드', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> },
                  ]).map(({ mode, title, icon }) => (
                    <button key={mode} onClick={() => setViewMode(mode)} title={title}
                      style={{ width: '28px', height: '26px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: viewMode === mode ? 'white' : 'transparent', color: viewMode === mode ? '#3730a3' : '#9CA3AF', boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'background 0.12s, color 0.12s' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* 콘텐츠 목록 */}
              {contentType === 'playbook' ? (
                pagesLoading ? (
                  <div className={viewMode === 'list' ? 'home-card-list' : 'home-card-grid'}>
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} style={{ borderRadius: '10px', background: 'white', border: '1px solid #E5E7EB', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ height: '12px', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                          <div style={{ height: '10px', width: '50%', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayedPages.length === 0 ? (
                  searchQuery.trim() ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px', color: '#6B7280' }}>
                      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}>🔍</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>&ldquo;{searchQuery}&rdquo; 검색 결과 없음</div>
                      <div style={{ fontSize: '13px' }}>다른 키워드로 검색해보세요.</div>
                      <button onClick={() => setSearchQuery('')} style={{ marginTop: '16px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', fontSize: '13px', color: '#4B5563', cursor: 'pointer' }}>검색 초기화</button>
                    </div>
                  ) : (
                    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <div style={{ margin: '0 auto 16px', width: '56px', height: '56px', borderRadius: '14px', background: '#dcfce7', display: 'grid', placeItems: 'center', color: '#059669' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>플레이북이 없어요</div>
                      <div style={{ fontSize: '12.5px', color: '#9CA3AF', marginBottom: '20px' }}>여러 매뉴얼을 하나의 문서로 엮어보세요.</div>
                      <button onClick={handleCreateGuidebook} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#059669', color: 'white', border: 'none', cursor: 'pointer' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        새 플레이북 만들기
                      </button>
                    </div>
                  )
                ) : (
                  <div className={viewMode === 'list' ? 'home-card-list' : 'home-card-grid'}>
                    {displayedPages.map(p => <PageCard key={p.id} page={p} viewMode={viewMode} />)}
                  </div>
                )
              ) : contentType === 'practice' ? (
                /* 실습하기 탭 — share_token이 있는 published 튜토리얼만 표시 */
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#e0f2fe', border: '1px solid #bae6fd', marginBottom: '16px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                    <div style={{ fontSize: '12.5px', color: '#0c4a6e', lineHeight: 1.6 }}>
                      <b>실습하기</b>는 캡처한 화면 위에서 단계별로 직접 클릭해보며 익히는 인터랙티브 연습 모드입니다. 매뉴얼 상세 페이지에서 실습 링크를 공유할 수 있어요.
                    </div>
                  </div>
                  {tutLoading ? (
                    <div className={viewMode === 'list' ? 'home-card-list' : 'home-card-grid'}>
                      {[1,2,3].map(i => (
                        <div key={i} style={{ borderRadius: '10px', background: 'white', border: '1px solid #E5E7EB', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: '11px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                          <div style={{ flex: 1, height: '12px', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                        </div>
                      ))}
                    </div>
                  ) : practiceTutorials.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6B7280' }}>
                      <div style={{ fontSize: '13px' }}>실습하기 가능한 매뉴얼이 없어요.<br/>녹화를 완료하면 자동으로 실습하기가 생성됩니다.</div>
                      <button onClick={() => setContentType('manual')} style={{ marginTop: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #bae6fd', background: 'white', fontSize: '13px', color: '#0369a1', cursor: 'pointer', fontWeight: 600 }}>매뉴얼 보기</button>
                    </div>
                  ) : (
                    <div className={viewMode === 'list' ? 'home-card-list' : 'home-card-grid'}>
                      {practiceTutorials.map(t => (
                        <TutorialCard key={t.id} tutorial={t} onContextMenu={handleContextMenu} onTitleChange={handleTitleChange} onMenuClick={handleContextMenu} viewMode={viewMode} />
                      ))}
                    </div>
                  )}
                </>
              ) : contentType === 'liveguide' ? (
                /* Live Guide 탭 — 기존 매뉴얼을 보여주되 Live Guide 안내 배너 추가 */
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: '#ede9fe', border: '1px solid #c4b5fd', marginBottom: '16px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <div style={{ fontSize: '12.5px', color: '#5b21b6', lineHeight: 1.6 }}>
                      <b>Live Guide</b>는 MIMIC 익스텐션이 설치된 브라우저에서 매뉴얼을 단계별로 안내해주는 기능입니다. 아래에서 실행할 매뉴얼을 선택하세요.
                      {liveGuide && !liveGuide.paid && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>(이번 달 {liveGuide.used}/{liveGuide.limit}회 사용)</span>
                      )}
                    </div>
                  </div>
                  {tutLoading ? (
                    <div className={viewMode === 'list' ? 'home-card-list' : 'home-card-grid'}>
                      {[1,2,3].map(i => (
                        <div key={i} style={{ borderRadius: '10px', background: 'white', border: '1px solid #E5E7EB', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: '11px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                          <div style={{ flex: 1, height: '12px', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                        </div>
                      ))}
                    </div>
                  ) : displayedTutorials.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6B7280' }}>
                      <div style={{ fontSize: '13px' }}>Live Guide로 실행할 매뉴얼이 없어요.</div>
                      <button onClick={() => setContentType('manual')} style={{ marginTop: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #c4b5fd', background: 'white', fontSize: '13px', color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}>매뉴얼 보기</button>
                    </div>
                  ) : (
                    <div className={viewMode === 'list' ? 'home-card-list' : 'home-card-grid'}>
                      {displayedTutorials.map(t => (
                        <TutorialCard key={t.id} tutorial={t} onContextMenu={handleContextMenu} onTitleChange={handleTitleChange} onMenuClick={handleContextMenu} viewMode={viewMode} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* 매뉴얼 탭 (기존) */
                tutLoading ? (
                  <div className={viewMode === 'list' ? 'home-card-list' : 'home-card-grid'}>
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} style={{ borderRadius: '10px', background: 'white', border: '1px solid #E5E7EB', padding: viewMode === 'compact' ? '7px 10px' : '11px 13px', display: 'flex', alignItems: 'center', gap: '11px' }}>
                        <div style={{ width: viewMode === 'compact' ? '24px' : '34px', height: viewMode === 'compact' ? '24px' : '34px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ height: '12px', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                          {viewMode !== 'compact' && <div style={{ height: '10px', width: '50%', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayedTutorials.length === 0 ? (
                  searchQuery.trim() ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px', color: '#6B7280' }}>
                      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}>🔍</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        &ldquo;{searchQuery}&rdquo; 검색 결과 없음
                      </div>
                      <div style={{ fontSize: '13px' }}>다른 키워드로 검색해보세요.</div>
                      <button onClick={() => setSearchQuery('')} style={{ marginTop: '16px', padding: '7px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', fontSize: '13px', color: '#4B5563', cursor: 'pointer' }}>
                        검색 초기화
                      </button>
                    </div>
                  ) : (
                    <EmptyState onRecord={() => setShowRecordingModal(true)} onBlank={handleCreateBlank} onGuidebook={handleCreateGuidebook}
                      label={activeTab === 'team' ? '팀 매뉴얼이 없어요' : activeFolder !== 'all' ? '이 폴더에 매뉴얼이 없어요' : undefined} />
                  )
                ) : (
                  <div className={viewMode === 'list' ? 'home-card-list' : 'home-card-grid'}>
                    {displayedTutorials.map(t => (
                      <TutorialCard key={t.id} tutorial={t} onContextMenu={handleContextMenu} onTitleChange={handleTitleChange} onMenuClick={handleContextMenu} viewMode={viewMode} />
                    ))}
                  </div>
                )
              )}
            </div>
          </main>
        </div>
      </div>

      {/* ── 모바일 드로어 — 사이드바 내용 전체 ── */}
      {showDrawer && (
        <>
          {/* 배경 오버레이 */}
          <div onClick={() => setShowDrawer(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          {/* 드로어 본체 */}
          <div style={{
            position: 'fixed', left: 0, top: 0, bottom: 0, width: '280px',
            background: 'var(--mm-bg)', zIndex: 201,
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
            boxShadow: '4px 0 24px rgba(0,0,0,0.18)',
            animation: 'drawerIn 0.22s ease',
          }}>
            {/* 드로어 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '1px solid var(--mm-border-light)', flexShrink: 0 }}>
              <Link href="/home" onClick={() => setShowDrawer(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28"><circle cx="50" cy="50" r="50" fill="#3730a3"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text></svg>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#3730a3', letterSpacing: '-0.03em' }}>MIMIC</span>
              </Link>
              <button onClick={() => setShowDrawer(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#F3F4F6', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#6B7280' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
              {/* 네비게이션 */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '16px' }}>
                {[
                  { label: '홈', href: '/home', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                  { label: '마이페이지', href: '/mypage', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                  { label: '설정', href: '/settings', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
                  { label: '휴지통', href: '/trash', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> },
                  { label: '도움말', href: '/help', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
                ].map(item => (
                  <Link key={item.label} href={item.href} onClick={() => setShowDrawer(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', fontSize: '13.5px', textDecoration: 'none', color: '#374151', fontWeight: 500 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {item.icon}{item.label}
                  </Link>
                ))}
              </nav>

              <div style={{ height: '1px', background: 'var(--mm-border-light)', marginBottom: '12px' }} />

              {/* 내 워크스페이스 */}
              <button onClick={() => setMyOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', marginBottom: '2px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: activeTab === 'my' ? '#3730a3' : '#E5E7EB', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', flex: 1, textAlign: 'left' }}>내 워크스페이스</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: myOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {myOpen && (
                <div style={{ paddingLeft: '10px', marginLeft: '18px', borderLeft: '2px solid #F3F4F6', marginBottom: '8px' }}>
                  {[
                    { id: 'all' as const, label: '전체', count: tutorials.length },
                    { id: null, label: '미분류', count: tutorials.filter(t => !t.folder_id).length },
                  ].map(item => (
                    <button key={String(item.id)}
                      onClick={() => { setActiveTab('my'); setActiveFolder(item.id); setShowDrawer(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '7px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left', background: folderItemActive(item.id) ? '#e0e7ff' : 'transparent', color: folderItemActive(item.id) ? '#3730a3' : '#4B5563', fontWeight: folderItemActive(item.id) ? 600 : 400 }}>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{item.count}</span>
                    </button>
                  ))}
                  {folders.map(f => (
                    <button key={f.id}
                      onClick={() => { setActiveTab('my'); setActiveFolder(f.id); setShowDrawer(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '7px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left', background: folderItemActive(f.id) ? `${f.color}15` : 'transparent', color: folderItemActive(f.id) ? f.color : '#4B5563', fontWeight: folderItemActive(f.id) ? 600 : 400 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: f.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{tutorials.filter(t => t.folder_id === f.id).length}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 팀 워크스페이스 */}
              <button onClick={() => setTeamOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', marginBottom: '2px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: activeTab === 'team' ? '#3730a3' : '#E5E7EB', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', flex: 1, textAlign: 'left' }}>팀 워크스페이스</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: teamOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {teamOpen && (
                <div style={{ paddingLeft: '10px', marginLeft: '18px', borderLeft: '2px solid #F3F4F6', marginBottom: '8px' }}>
                  {workspaces.length === 0
                    ? <div style={{ padding: '6px 8px', fontSize: '13px', color: '#D1D5DB' }}>없음</div>
                    : workspaces.map(ws => (
                      <button key={ws.id}
                        onClick={() => { setActiveTab('team'); setActiveWorkspace(ws.id); setShowDrawer(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '7px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left', background: activeTab === 'team' && activeWorkspace === ws.id ? '#e0e7ff' : 'transparent', color: activeTab === 'team' && activeWorkspace === ws.id ? '#3730a3' : '#4B5563', fontWeight: activeTab === 'team' && activeWorkspace === ws.id ? 600 : 400 }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{ws.member_count ?? 0}명</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>

            {/* 사용량 + 유저 (하단 고정) */}
            <div style={{ flexShrink: 0, padding: '12px', borderTop: '1px solid var(--mm-border-light)' }}>
              {/* 사용량 */}
              {!authLoading && !isPro && (
                <div style={{ padding: '10px', borderRadius: '10px', background: '#F9FAFB', border: '1px solid #F3F4F6', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>오늘 사용량</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{usedToday} / {dailyLimit}</span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '999px', background: '#E5E7EB', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: usedToday >= dailyLimit ? '#EF4444' : '#3730a3', width: `${Math.min(100, (usedToday / dailyLimit) * 100)}%` }} />
                  </div>
                </div>
              )}
              {/* 유저 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px' }}>
                {user?.avatar_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={user.avatar_url} alt={user.name} style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                  : <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{firstName.charAt(0) || '?'}</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name ?? '내 계정'}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{user?.plan === 'free' ? '무료 플랜' : user?.plan === 'team' ? 'Team' : 'Pro'}</div>
                </div>
                <button onClick={() => { handleSignOut(); setShowDrawer(false); }}
                  title="로그아웃"
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#F3F4F6', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#9CA3AF', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes recPulse { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:1; transform:scale(1.2); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes drawerIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes folderPanelIn { from { transform: translateX(-28px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      {/* AI 어시스턴트 챗봇 */}
      <AgentChat />
    </>
  );
}
