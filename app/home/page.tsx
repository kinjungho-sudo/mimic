'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RecordingModal } from '@/components/dashboard/RecordingModal';
import { createTutorial } from '@/lib/api/tutorials';
import type { Tutorial, Workspace, Folder } from '@/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '안녕하세요';
  return '안녕하세요';
}

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

// ── 튜토리얼 카드 ──────────────────────────────────────────

function TutorialCard({ tutorial, onContextMenu, onTitleChange, onMenuClick }: {
  tutorial: Tutorial;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onMenuClick: (e: React.MouseEvent, id: string) => void;
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

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, tutorial.id); }}
      onClick={() => { if (!editingTitle) router.push(`/manual/${tutorial.id}/editor`); }}
      style={{
        background: 'white', borderRadius: '10px', cursor: 'pointer',
        border: `1px solid ${hovered ? '#a5b4fc' : '#E5E7EB'}`,
        boxShadow: hovered ? '0 3px 12px rgba(55,48,163,0.07)' : '0 1px 2px rgba(17,24,39,0.04)',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        display: 'flex', alignItems: 'center', gap: '11px',
        padding: '11px 13px',
      }}
    >
      {/* 아이콘 */}
      <div style={{ width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0, background: `${color}12`, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {activeFavicon && !faviconError
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={activeFavicon} alt="" width={16} height={16} onError={() => {
              if (activeFavicon === googleFavicon && ddgFavicon) {
                setFaviconSrc(ddgFavicon);
              } else {
                setFaviconError(true);
              }
            }} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
        }
      </div>

      {/* 텍스트 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingTitle ? (
          <input ref={titleInputRef} value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(tutorial.title); } }}
            onClick={e => e.stopPropagation()} disabled={savingTitle}
            style={{ fontSize: '13px', fontWeight: 600, color: '#111827', border: '1.5px solid #3730a3', borderRadius: '5px', padding: '1px 6px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
        ) : (
          <div
            onClick={e => { e.stopPropagation(); setEditingTitle(true); }}
            title="클릭해서 제목 편집"
            style={{ fontSize: '13px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}>
            {tutorial.title}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
          {domain && <span style={{ fontSize: '11px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{domain}</span>}
          {domain && <span style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#D1D5DB', flexShrink: 0 }} />}
          <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{dateStr}</span>
          {stepCount > 0 && <><span style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#D1D5DB', flexShrink: 0 }} /><span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{stepCount}단계</span></>}
          {tutorial.status === 'published' && <span style={{ fontSize: '10px', fontWeight: 600, color: '#16A34A', background: '#DCFCE7', padding: '1px 5px', borderRadius: '999px', flexShrink: 0 }}>공유</span>}
        </div>
      </div>
      {/* hover 시 ⋯ 메뉴 버튼 */}
      <button
        onClick={e => { e.stopPropagation(); onMenuClick(e, tutorial.id); }}
        style={{
          flexShrink: 0, width: '28px', height: '28px', borderRadius: '6px',
          border: 'none', background: hovered ? '#F3F4F6' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#6B7280', opacity: hovered ? 1 : 0, transition: 'opacity 0.1s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
    </article>
  );
}

// ── 빈 상태 ───────────────────────────────────────────────

function EmptyState({ onRecord, onBlank, label }: { onRecord: () => void; onBlank: () => void; label?: string }) {
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

  // 폴더 생성/편집
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // 사이드바 섹션 접기/펼치기
  const [myOpen, setMyOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const FOLDER_LIMIT = 5;

  // 컨텍스트 메뉴
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);

  // 모바일 드로어
  const [showDrawer, setShowDrawer] = useState(false);

  const newMenuRef = useRef<HTMLDivElement>(null);

  const loadTutorials = useCallback(async (workspaceId?: string) => {
    setTutLoading(true);
    try {
      const url = workspaceId ? `/api/tutorials?workspace_id=${workspaceId}` : '/api/tutorials';
      const res = await fetch(url);
      if (res.ok) setTutorials(await res.json());
    } finally { setTutLoading(false); }
  }, []);

  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/folders');
    if (res.ok) setFolders(await res.json());
  }, []);

  const loadWorkspaces = useCallback(async () => {
    const res = await fetch('/api/workspaces');
    if (res.ok) setWorkspaces(await res.json());
  }, []);

  useEffect(() => {
    if (!user) return;
    loadTutorials();
    loadFolders();
    loadWorkspaces();
  }, [user, loadTutorials, loadFolders, loadWorkspaces]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'team' && activeWorkspace) loadTutorials(activeWorkspace);
    else if (activeTab === 'my') loadTutorials();
  }, [activeTab, activeWorkspace, user, loadTutorials]);

  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') loadTutorials(activeTab === 'team' ? activeWorkspace ?? undefined : undefined); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [activeTab, activeWorkspace, loadTutorials]);

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
      const tutorial = await createTutorial();
      router.push(`/manual/${tutorial.id}/editor`);
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
    await fetch(`/api/tutorials/${tutorialId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    });
    setTutorials(prev => prev.map(t => t.id === tutorialId ? { ...t, folder_id: folderId } : t));
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName.trim() }) });
      if (res.ok) { const folder = await res.json(); setFolders(prev => [...prev, folder]); setNewFolderName(''); setShowNewFolderInput(false); }
    } finally { setCreatingFolder(false); }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('폴더를 삭제할까요? 안의 매뉴얼은 유지됩니다.')) return;
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    setFolders(prev => prev.filter(f => f.id !== id));
    setTutorials(prev => prev.map(t => t.folder_id === id ? { ...t, folder_id: null } : t));
    if (activeFolder === id) setActiveFolder('all');
  };

  const handleRenameFolder = async (id: string) => {
    const trimmed = editingFolderName.trim();
    if (!trimmed) { setEditingFolderId(null); return; }
    await fetch(`/api/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) });
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: trimmed } : f));
    setEditingFolderId(null);
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
    let list = activeTab === 'team' ? tutorials : (() => {
      if (activeFolder === 'all') return tutorials;
      if (activeFolder === null) return tutorials.filter(t => !t.folder_id);
      return tutorials.filter(t => t.folder_id === activeFolder);
    })();
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q));
    }
    return list;
  })();

  // 폴더 트리 아이템 공통 스타일 헬퍼
  const folderItemActive = (id: string | null | 'all') => activeFolder === id && activeTab === 'my';

  return (
    <>
      {showRecordingModal && <RecordingModal onClose={() => setShowRecordingModal(false)} />}
      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          folders={folders}
          tutorials={tutorials}
          workspaces={workspaces}
          onMove={handleMoveToFolder}
          onMoveToWorkspace={handleMoveToWorkspace}
          onDelete={handleRemove}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: '13.5px', color: 'var(--mm-text-1)', background: 'var(--mm-bg-soft)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1 }} className="home-layout-grid">

          {/* ── 사이드바 — 모바일에서 숨김 ── */}
          <aside className="home-sidebar" style={{ background: 'var(--mm-bg)', borderRight: '1px solid var(--mm-border-light)', padding: '16px 12px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>

            {/* 로고 */}
            <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 16px', textDecoration: 'none' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32" style={{ flexShrink: 0 }}><circle cx="50" cy="50" r="50" fill="#3730a3"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text></svg>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>MIMIC</span>
            </Link>

            {/* 네비게이션 */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {[
                { label: '홈', href: '/home', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                { label: '설정', href: '/settings', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
              ].map(item => (
                <Link key={item.label} href={item.href}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', color: '#4B5563' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {item.icon}{item.label}
                </Link>
              ))}
            </nav>

            {/* ── 워크스페이스 트리 ── */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '1px' }}>

              {/* ① 내 워크스페이스 헤더 (클릭 = 접기/펼치기) */}
              <button onClick={() => setMyOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: activeTab === 'my' ? '#3730a3' : '#E5E7EB', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', flex: 1 }}>내 워크스페이스</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: myOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* ① 내 워크스페이스 하위 */}
              {myOpen && (
                <div style={{ paddingLeft: '12px', marginLeft: '19px', borderLeft: '2px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '2px' }}>
                  {[
                    { id: 'all' as const, label: '전체', count: tutorials.length },
                    { id: null, label: '미분류', count: tutorials.filter(t => !t.folder_id).length },
                  ].map(item => (
                    <button key={String(item.id)} onClick={() => { setActiveTab('my'); setActiveFolder(item.id); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left', background: folderItemActive(item.id) ? '#e0e7ff' : 'transparent', color: folderItemActive(item.id) ? '#3730a3' : '#4B5563', fontWeight: folderItemActive(item.id) ? 600 : 400 }}
                      onMouseEnter={e => { if (!folderItemActive(item.id)) (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}
                      onMouseLeave={e => { if (!folderItemActive(item.id)) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {!tutLoading && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{item.count}</span>}
                    </button>
                  ))}

                  {/* 폴더 목록 */}
                  {(showAllFolders ? folders : folders.slice(0, FOLDER_LIMIT)).map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                      {editingFolderId === f.id ? (
                        <input autoFocus value={editingFolderName}
                          onChange={e => setEditingFolderName(e.target.value)}
                          onBlur={() => handleRenameFolder(f.id)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(f.id); if (e.key === 'Escape') setEditingFolderId(null); }}
                          style={{ flex: 1, padding: '4px 7px', borderRadius: '6px', border: '1.5px solid #3730a3', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                      ) : (
                        <button
                          onClick={() => { setActiveTab('my'); setActiveFolder(f.id); }}
                          onDoubleClick={() => { setEditingFolderId(f.id); setEditingFolderName(f.name); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left', background: folderItemActive(f.id) ? `${f.color}15` : 'transparent', color: folderItemActive(f.id) ? f.color : '#4B5563', fontWeight: folderItemActive(f.id) ? 600 : 400 }}
                          onMouseEnter={e => { if (!folderItemActive(f.id)) (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}
                          onMouseLeave={e => { if (!folderItemActive(f.id)) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                          <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: f.color, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          </span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{tutorials.filter(t => t.folder_id === f.id).length}</span>
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); handleDeleteFolder(f.id); }}
                        style={{ width: '16px', height: '16px', borderRadius: '3px', border: 'none', background: 'transparent', color: '#D1D5DB', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, opacity: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0'; (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}

                  {/* 더 보기 / 접기 */}
                  {folders.length > FOLDER_LIMIT && (
                    <button onClick={() => setShowAllFolders(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#9CA3AF', width: '100%' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7280'; (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        style={{ transform: showAllFolders ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                      {showAllFolders ? '접기' : `${folders.length - FOLDER_LIMIT}개 더 보기`}
                    </button>
                  )}

                  {/* 새 폴더 */}
                  {showNewFolderInput ? (
                    <form onSubmit={handleCreateFolder} style={{ display: 'flex', gap: '4px', paddingTop: '2px' }}>
                      <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="폴더 이름"
                        onKeyDown={e => { if (e.key === 'Escape') setShowNewFolderInput(false); }}
                        style={{ flex: 1, padding: '4px 7px', borderRadius: '6px', border: '1px solid #a5b4fc', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                      <button type="submit" disabled={creatingFolder || !newFolderName.trim()}
                        style={{ padding: '4px 8px', borderRadius: '6px', background: '#3730a3', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        {creatingFolder ? '...' : '추가'}
                      </button>
                    </form>
                  ) : (
                    <button onClick={() => { setShowNewFolderInput(true); setNewFolderName(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '4px 8px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#9CA3AF' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7280'; (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      새 폴더
                    </button>
                  )}
                </div>
              )}

              {/* ② 팀 워크스페이스 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1px', marginTop: '4px' }}>
                <button onClick={() => setTeamOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, padding: '7px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: activeTab === 'team' ? '#3730a3' : '#E5E7EB', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', flex: 1 }}>팀 워크스페이스</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
                    style={{ transform: teamOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <button onClick={() => { setShowNewWsInput(v => !v); setNewWsName(''); setTeamOpen(true); }}
                  style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center', borderRadius: '6px', flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLButtonElement).style.color = '#4B5563'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}
                  title="새 워크스페이스">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>

              {/* ② 팀 워크스페이스 하위 */}
              {teamOpen && (
                <div style={{ paddingLeft: '12px', marginLeft: '19px', borderLeft: '2px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '2px' }}>
                  {showNewWsInput && (
                    <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', gap: '4px', paddingBottom: '4px' }}>
                      <input autoFocus value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="워크스페이스 이름"
                        style={{ flex: 1, padding: '4px 7px', borderRadius: '6px', border: '1px solid #a5b4fc', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                      <button type="submit" disabled={creatingWs || !newWsName.trim()}
                        style={{ padding: '4px 8px', borderRadius: '6px', background: '#3730a3', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        {creatingWs ? '...' : '만들기'}
                      </button>
                    </form>
                  )}
                  {workspaces.length === 0
                    ? <div style={{ padding: '4px 8px', fontSize: '13px', color: '#D1D5DB' }}>없음</div>
                    : workspaces.map(ws => (
                      <div key={ws.id} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                        <button onClick={() => { setActiveTab('team'); setActiveWorkspace(ws.id); }}
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
                {!isPro && <Link href="/settings" style={{ display: 'block', marginTop: '10px', padding: '6px', borderRadius: '7px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', fontSize: '11.5px', fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>Pro로 업그레이드</Link>}
              </div>
            )}

            {/* 유저 */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', color: '#374151' }}>
                {user?.avatar_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={user.avatar_url} alt={user.name} style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                  : <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{authLoading ? '·' : firstName.charAt(0) || '?'}</div>
                }
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authLoading ? '...' : (user?.name ?? '내 계정')}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{user?.plan === 'free' ? '무료 플랜' : user?.plan === 'team' ? 'Team' : 'Pro'}</div>
                </div>
              </div>
              <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                로그아웃
              </button>
            </div>
          </aside>

          {/* ── 메인 ── */}
          <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* 헤더 — 모바일에서는 로고+버튼만 */}
            <header style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '60px', padding: '0 16px', background: 'var(--mm-bg)', borderBottom: '1px solid var(--mm-border-light)', position: 'sticky', top: 0, zIndex: 30 }}>
              {/* 모바일 전용: 로고 (햄버거는 우측으로 이동) */}
              <div className="home-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="26" height="26"><circle cx="50" cy="50" r="50" fill="#3730a3"/><text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text></svg>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>MIMIC</span>
                </Link>
              </div>
              <div
                className="home-search-bar"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '440px', height: '40px', padding: '0 14px', border: `1.5px solid ${searchQuery ? '#4F46E5' : '#E5E7EB'}`, borderRadius: '10px', background: searchQuery ? '#F5F3FF' : 'white', color: '#9CA3AF', transition: 'border-color 0.15s, background 0.15s', boxShadow: searchQuery ? '0 0 0 3px rgba(79,70,229,0.10)' : 'none' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={searchQuery ? '#4F46E5' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  placeholder="매뉴얼 이름으로 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13.5px', fontFamily: 'inherit', color: '#111827' }}
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
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div ref={newMenuRef} style={{ position: 'relative' }}>
                  <button onClick={() => setShowNewMenu(v => !v)} disabled={creating}
                    className="home-new-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '9px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', fontSize: '13.5px', fontWeight: 600, boxShadow: '0 2px 8px rgba(55,48,163,0.28)', opacity: creating ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                    {creating
                      ? <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                      : <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.85)', animation: 'recPulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
                    }
                    새 매뉴얼
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: showNewMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showNewMenu && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: 'white', borderRadius: '12px', boxShadow: '0 8px 28px rgba(17,24,39,0.14), 0 0 0 1px rgba(0,0,0,0.06)', overflow: 'hidden', zIndex: 100 }}>
                      {/* 녹화 — 데스크톱 전용 (모바일에서 Chrome 확장 없음) */}
                      <button className="home-recording-btn" onClick={() => { setShowNewMenu(false); setShowRecordingModal(true); }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', padding: '13px 15px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#FEE2E2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="#EF4444"/></svg>
                        </span>
                        <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>화면 녹화로 만들기</div><div style={{ fontSize: '11.5px', color: '#6B7280' }}>클릭 동작을 자동 캡처</div></div>
                      </button>
                      <div className="home-recording-divider" style={{ height: '1px', background: '#F3F4F6', margin: '0 12px' }} />
                      <button onClick={handleCreateBlank}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', padding: '13px 15px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#e0e7ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        </span>
                        <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>직접 편집하기</div><div style={{ fontSize: '11.5px', color: '#6B7280' }}>이미지 업로드해 제작</div></div>
                      </button>
                    </div>
                  )}
                </div>
                {/* 모바일 전용: 햄버거 버튼 (우측 상단) */}
                <button className="home-hamburger-btn"
                  onClick={() => setShowDrawer(true)}
                  style={{ display: 'none', width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', placeItems: 'center', cursor: 'pointer', color: '#374151', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
              </div>
            </header>

            {/* 본문 */}
            <div className="home-main-body" style={{ padding: '28px 32px', flex: 1 }}>
              {/* 인사말 */}
              <div style={{ marginBottom: '20px' }}>
                <h1 className="home-greeting" style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.025em', margin: 0, color: '#0F172A' }}>
                  {authLoading ? '' : `${greeting()}, ${firstName}님`} 👋
                </h1>
              </div>

              {/* 탭 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #F3F4F6' }}>
                {([['my', '내 매뉴얼'], ['team', '팀 매뉴얼']] as const).map(([tab, label]) => (
                  <button key={tab}
                    onClick={() => { setActiveTab(tab); if (tab === 'team' && workspaces.length > 0) setActiveWorkspace(workspaces[0].id); }}
                    style={{ padding: '7px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13.5px', fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? '#3730a3' : '#6B7280', borderBottom: `2px solid ${activeTab === tab ? '#3730a3' : 'transparent'}`, marginBottom: '-2px', transition: 'color 0.15s' }}>
                    {label}
                    {tab === 'my' && !tutLoading && <span style={{ marginLeft: '5px', fontSize: '11.5px', fontWeight: 400, color: '#9CA3AF' }}>{displayedTutorials.length}</span>}
                  </button>
                ))}
              </div>

              {/* 팀 탭: 워크스페이스 선택 */}
              {activeTab === 'team' && (
                <div style={{ marginBottom: '20px' }}>
                  {workspaces.length === 0 ? (
                    <div style={{ padding: '28px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: '13.5px', color: '#6B7280', marginBottom: '12px' }}>참여 중인 워크스페이스가 없습니다.</div>
                      <button onClick={() => setShowNewWsInput(true)} style={{ padding: '7px 14px', borderRadius: '8px', background: '#3730a3', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>워크스페이스 만들기</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {workspaces.map(ws => (
                        <button key={ws.id} onClick={() => setActiveWorkspace(ws.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '999px', border: `1.5px solid ${activeWorkspace === ws.id ? '#3730a3' : '#E5E7EB'}`, background: activeWorkspace === ws.id ? '#e0e7ff' : 'white', color: activeWorkspace === ws.id ? '#3730a3' : '#6B7280', fontSize: '12.5px', fontWeight: activeWorkspace === ws.id ? 600 : 400, cursor: 'pointer' }}>
                          {ws.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 그리드 */}
              {tutLoading ? (
                <div className="home-card-grid">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{ borderRadius: '10px', background: 'white', border: '1px solid #E5E7EB', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: '11px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ height: '12px', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                        <div style={{ height: '10px', width: '50%', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
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
                  <EmptyState onRecord={() => setShowRecordingModal(true)} onBlank={handleCreateBlank}
                    label={activeTab === 'team' ? '팀 매뉴얼이 없어요' : activeFolder !== 'all' ? '이 폴더에 매뉴얼이 없어요' : undefined} />
                )
              ) : (
                <div className="home-card-grid">
                  {displayedTutorials.map(t => (
                    <TutorialCard key={t.id} tutorial={t} onContextMenu={handleContextMenu} onTitleChange={handleTitleChange} onMenuClick={handleContextMenu} />
                  ))}
                </div>
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
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>MIMIC</span>
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
      `}</style>
    </>
  );
}
