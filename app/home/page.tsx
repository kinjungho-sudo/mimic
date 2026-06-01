'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { RecordingModal } from '@/components/dashboard/RecordingModal';
import { createTutorial } from '@/lib/api/tutorials';
import type { Tutorial, Workspace, Folder } from '@/types';

// ── 유틸 ──────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '안녕하세요';
  return '안녕하세요';
}

const CARD_COLORS = ['#4F46E5', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444'];
function cardColor(id: string) {
  return CARD_COLORS[id.charCodeAt(0) % CARD_COLORS.length];
}

function getDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

// ── 튜토리얼 카드 ──────────────────────────────────────────

function TutorialCard({ tutorial, onDelete, onTitleChange, onMoveToFolder, folders }: {
  tutorial: Tutorial;
  onDelete: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onMoveToFolder: (tutorialId: string, folderId: string | null) => void;
  folders: Folder[];
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(tutorial.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  const color = cardColor(tutorial.id);
  const stepCount = tutorial.step_count ?? 0;
  const dateStr = new Date(tutorial.updated_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\. /g, '/').replace(/\.$/, '');
  const domain = getDomain(tutorial.first_page_url);
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null;

  const saveTitle = useCallback(async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === tutorial.title) { setEditingTitle(false); setTitleDraft(tutorial.title); return; }
    setSavingTitle(true);
    try {
      await fetch(`/api/tutorials/${tutorial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      onTitleChange(tutorial.id, trimmed);
    } finally { setSavingTitle(false); setEditingTitle(false); }
  }, [titleDraft, tutorial.id, tutorial.title, onTitleChange]);

  useEffect(() => { if (editingTitle) titleInputRef.current?.focus(); }, [editingTitle]);

  // 폴더 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!showFolderMenu) return;
    const handler = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) setShowFolderMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFolderMenu]);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!editingTitle && !showFolderMenu) router.push(`/manual/${tutorial.id}/editor`); }}
      style={{
        background: 'white', borderRadius: '12px', cursor: 'pointer',
        border: `1px solid ${hovered ? '#C7D2FE' : '#E5E7EB'}`,
        boxShadow: hovered ? '0 4px 16px rgba(79,70,229,0.08)' : '0 1px 3px rgba(17,24,39,0.05)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 14px', position: 'relative',
      }}
    >
      {/* 파비콘 or 컬러 아이콘 */}
      <div style={{ width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0, background: `${color}15`, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {faviconUrl && !faviconError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={faviconUrl} alt="" width={18} height={18} onError={() => setFaviconError(true)} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        )}
      </div>

      {/* 제목 + 메타 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingTitle ? (
          <input ref={titleInputRef} value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(tutorial.title); } }}
            onClick={e => e.stopPropagation()} disabled={savingTitle}
            style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', border: '1.5px solid #4F46E5', borderRadius: '6px', padding: '2px 6px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
        ) : (
          <div onClick={e => { e.stopPropagation(); setEditingTitle(true); }} title="클릭해서 제목 편집"
            style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}>
            {tutorial.title}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
          {domain && <span style={{ fontSize: '11px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>{domain}</span>}
          {domain && <span style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#D1D5DB', flexShrink: 0 }} />}
          <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{dateStr}</span>
          {stepCount > 0 && <><span style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#D1D5DB', flexShrink: 0 }} /><span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>{stepCount}단계</span></>}
          {tutorial.status === 'published' && <span style={{ fontSize: '10px', fontWeight: 600, color: '#16A34A', background: '#DCFCE7', padding: '1px 5px', borderRadius: '999px', flexShrink: 0 }}>공유</span>}
        </div>
      </div>

      {/* 액션 버튼들 — 호버 시 노출 */}
      {hovered && (
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {/* 폴더 이동 */}
          <div ref={folderMenuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowFolderMenu(v => !v)}
              style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: showFolderMenu ? '#EEF2FF' : 'transparent', color: showFolderMenu ? '#4F46E5' : '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
              title="폴더 이동">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </button>
            {showFolderMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, width: '160px', background: 'white', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)', zIndex: 50, overflow: 'hidden' }}>
                <div style={{ padding: '4px' }}>
                  <button onClick={() => { onMoveToFolder(tutorial.id, null); setShowFolderMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 10px', border: 'none', background: !tutorial.folder_id ? '#EEF2FF' : 'transparent', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px', color: !tutorial.folder_id ? '#4F46E5' : '#374151', fontWeight: !tutorial.folder_id ? 600 : 400, textAlign: 'left' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    폴더 없음
                  </button>
                  {folders.map(f => (
                    <button key={f.id} onClick={() => { onMoveToFolder(tutorial.id, f.id); setShowFolderMenu(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 10px', border: 'none', background: tutorial.folder_id === f.id ? '#EEF2FF' : 'transparent', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px', color: tutorial.folder_id === f.id ? '#4F46E5' : '#374151', fontWeight: tutorial.folder_id === f.id ? 600 : 400, textAlign: 'left' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: f.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* 삭제 */}
          <button onClick={() => { if (confirm('이 매뉴얼을 삭제할까요?')) onDelete(tutorial.id); }}
            style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}
            title="삭제">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      )}
    </article>
  );
}

// ── 빈 상태 ───────────────────────────────────────────────

function EmptyState({ onRecord, onBlank, label }: { onRecord: () => void; onBlank: () => void; label?: string }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ margin: '0 auto 16px', width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', display: 'grid', placeItems: 'center', color: '#4F46E5' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>{label ?? '매뉴얼이 없어요'}</div>
      <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '24px' }}>화면을 녹화하거나 직접 만들어보세요.</div>
      <div style={{ display: 'inline-flex', gap: '8px' }}>
        <button onClick={onRecord} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79,70,229,0.28)' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: 'recPulse 1.4s ease-in-out infinite' }} />
          화면 녹화
        </button>
        <button onClick={onBlank} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', borderRadius: '9px', fontSize: '13.5px', fontWeight: 600, background: 'white', color: '#4F46E5', border: '1.5px solid #C7D2FE', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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

  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [activeFolder, setActiveFolder] = useState<string | null | 'all'>('all'); // 'all' | null(미분류) | folderId
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null); // team tab에서 선택된 워크스페이스

  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNewWsInput, setShowNewWsInput] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

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

  // 탭/워크스페이스 변경 시 재로드
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'team' && activeWorkspace) loadTutorials(activeWorkspace);
    else if (activeTab === 'my') loadTutorials();
  }, [activeTab, activeWorkspace, user, loadTutorials]);

  // 다른 탭에서 돌아왔을 때 새로고침
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') loadTutorials(activeTab === 'team' ? activeWorkspace ?? undefined : undefined); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [activeTab, activeWorkspace, loadTutorials]);

  // 새 매뉴얼 메뉴 외부 클릭 닫기
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
    setShowNewMenu(false);
    setCreating(true);
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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setCreatingWs(true);
    try {
      const res = await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newWsName.trim() }) });
      if (res.ok) { const ws = await res.json(); setWorkspaces(prev => [ws, ...prev]); setNewWsName(''); setShowNewWsInput(false); }
    } finally { setCreatingWs(false); }
  };

  // 표시할 튜토리얼 필터링
  const displayedTutorials = activeTab === 'team' ? tutorials : (() => {
    if (activeFolder === 'all') return tutorials;
    if (activeFolder === null) return tutorials.filter(t => !t.folder_id);
    return tutorials.filter(t => t.folder_id === activeFolder);
  })();

  const FOLDER_COLORS = ['#4F46E5', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6B7280'];

  return (
    <>
      {showRecordingModal && <RecordingModal onClose={() => setShowRecordingModal(false)} />}

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: '13.5px', color: '#111827', background: '#F8F9FA' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1 }}>

          {/* ── 사이드바 ── */}
          <aside style={{ background: 'white', borderRight: '1px solid #F3F4F6', padding: '16px 12px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
            {/* 로고 */}
            <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 16px', textDecoration: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mimic-logo-2-2.png" alt="MIMIC" style={{ height: '32px', width: '32px', objectFit: 'contain', flexShrink: 0 }} />
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>MIMIC</span>
            </Link>

            {/* 네비게이션 */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { label: '홈', href: '/home', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                { label: '마이페이지', href: '/mypage', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                { label: '설정', href: '/settings', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
              ].map(item => (
                <Link key={item.label} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', fontSize: '13.5px', textDecoration: 'none', color: '#4B5563' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {item.icon}{item.label}
                </Link>
              ))}
            </nav>

            {/* 워크스페이스 */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>워크스페이스</span>
                <button onClick={() => { setShowNewWsInput(v => !v); setNewWsName(''); }}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }} title="새 워크스페이스">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
              {showNewWsInput && (
                <form onSubmit={handleCreateWorkspace} style={{ padding: '0 10px', marginBottom: '6px', display: 'flex', gap: '4px' }}>
                  <input autoFocus value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="이름" style={{ flex: 1, padding: '5px 8px', borderRadius: '7px', border: '1px solid #C7D2FE', fontSize: '12px', outline: 'none', fontFamily: 'inherit' }} />
                  <button type="submit" disabled={creatingWs || !newWsName.trim()} style={{ padding: '5px 8px', borderRadius: '7px', background: '#4F46E5', color: 'white', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{creatingWs ? '...' : '만들기'}</button>
                </form>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {workspaces.length === 0
                  ? <div style={{ padding: '6px 10px', fontSize: '12px', color: '#D1D5DB' }}>없음</div>
                  : workspaces.map(ws => (
                    <Link key={ws.id} href={`/workspace/${ws.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', color: '#4B5563' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ws.name}</span>
                      <span style={{ fontSize: '10.5px', color: '#9CA3AF', flexShrink: 0 }}>{ws.member_count ?? 0}명</span>
                    </Link>
                  ))}
              </div>
            </div>

            {/* 사용량 */}
            {!authLoading && (
              <div style={{ marginTop: 'auto', padding: '12px 10px', borderRadius: '10px', background: '#F9FAFB', border: '1px solid #F3F4F6', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '8px', fontWeight: 500 }}>이번 달 사용량</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>매뉴얼</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                    {usedToday}{isPro ? '' : ` / ${dailyLimit}`}
                    {isPro && <span style={{ fontSize: '10px', color: '#10B981', marginLeft: '4px', fontWeight: 500 }}>무제한</span>}
                  </span>
                </div>
                {!isPro && (
                  <div style={{ height: '4px', borderRadius: '999px', background: '#E5E7EB', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: usedToday >= dailyLimit ? '#EF4444' : '#4F46E5', width: `${Math.min(100, (usedToday / dailyLimit) * 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                )}
                {!isPro && (
                  <Link href="/mypage" style={{ display: 'block', marginTop: '10px', padding: '6px', borderRadius: '7px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', fontSize: '11.5px', fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>Pro로 업그레이드</Link>
                )}
              </div>
            )}

            {/* 하단 유저 */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <Link href="/mypage" style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', textDecoration: 'none', color: '#374151' }}>
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} /> // eslint-disable-line @next/next/no-img-element
                  : <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{authLoading ? '·' : firstName.charAt(0) || '?'}</div>
                }
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authLoading ? '...' : (user?.name ?? '내 계정')}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{user?.plan === 'free' ? '무료 플랜' : user?.plan === 'team' ? 'Team' : 'Pro'}</div>
                </div>
              </Link>
              <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                로그아웃
              </button>
            </div>
          </aside>

          {/* ── 메인 ── */}
          <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>

            {/* 헤더 */}
            <header style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '60px', padding: '0 32px', background: 'white', borderBottom: '1px solid #F3F4F6', position: 'sticky', top: 0, zIndex: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '380px', height: '36px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '9px', background: '#F9FAFB', color: '#9CA3AF' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input placeholder="매뉴얼 검색..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontFamily: 'inherit', color: '#374151' }} />
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <div ref={newMenuRef} style={{ position: 'relative' }}>
                  <button onClick={() => setShowNewMenu(v => !v)} disabled={creating}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '9px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', fontSize: '13.5px', fontWeight: 600, boxShadow: '0 2px 8px rgba(79,70,229,0.28)', opacity: creating ? 0.7 : 1 }}>
                    {creating
                      ? <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                      : <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.85)', animation: 'recPulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
                    }
                    새 매뉴얼
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: showNewMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showNewMenu && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: 'white', borderRadius: '12px', boxShadow: '0 8px 28px rgba(17,24,39,0.14), 0 0 0 1px rgba(0,0,0,0.06)', overflow: 'hidden', zIndex: 100 }}>
                      <button onClick={() => { setShowNewMenu(false); setShowRecordingModal(true); }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', padding: '13px 15px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#FEE2E2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="#EF4444"/></svg>
                        </span>
                        <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>화면 녹화로 만들기</div><div style={{ fontSize: '11.5px', color: '#6B7280' }}>클릭 동작을 자동 캡처</div></div>
                      </button>
                      <div style={{ height: '1px', background: '#F3F4F6', margin: '0 12px' }} />
                      <button onClick={handleCreateBlank}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', padding: '13px 15px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EEF2FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        </span>
                        <div><div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>직접 편집하기</div><div style={{ fontSize: '11.5px', color: '#6B7280' }}>이미지 업로드해 제작</div></div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* 본문 */}
            <div style={{ padding: '28px 32px', flex: 1 }}>

              {/* 인사말 */}
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 4px', color: '#0F172A' }}>
                  {authLoading ? '' : `${greeting()}, ${firstName}님`} 👋
                </h1>
              </div>

              {/* 탭: 내 매뉴얼 / 팀 매뉴얼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #F3F4F6' }}>
                {([['my', '내 매뉴얼'], ['team', '팀 매뉴얼']] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'team' && workspaces.length > 0) setActiveWorkspace(workspaces[0].id); }}
                    style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? '#4F46E5' : '#6B7280', borderBottom: `2px solid ${activeTab === tab ? '#4F46E5' : 'transparent'}`, marginBottom: '-2px', transition: 'color 0.15s' }}>
                    {label}
                    {tab === 'my' && !tutLoading && <span style={{ marginLeft: '6px', fontSize: '12px', fontWeight: 400, color: '#9CA3AF' }}>{tutorials.length}</span>}
                  </button>
                ))}
              </div>

              {/* 팀 워크스페이스 선택 */}
              {activeTab === 'team' && (
                <div style={{ marginBottom: '20px' }}>
                  {workspaces.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>참여 중인 워크스페이스가 없습니다.</div>
                      <button onClick={() => { setShowNewWsInput(true); }} style={{ padding: '8px 16px', borderRadius: '8px', background: '#4F46E5', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>워크스페이스 만들기</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {workspaces.map(ws => (
                        <button key={ws.id} onClick={() => setActiveWorkspace(ws.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '999px', border: `1.5px solid ${activeWorkspace === ws.id ? '#4F46E5' : '#E5E7EB'}`, background: activeWorkspace === ws.id ? '#EEF2FF' : 'white', color: activeWorkspace === ws.id ? '#4F46E5' : '#6B7280', fontSize: '13px', fontWeight: activeWorkspace === ws.id ? 600 : 400, cursor: 'pointer' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                          </div>
                          {ws.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 내 매뉴얼: 폴더 필터 */}
              {activeTab === 'my' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {/* 전체 */}
                  <button onClick={() => setActiveFolder('all')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '999px', border: `1.5px solid ${activeFolder === 'all' ? '#4F46E5' : '#E5E7EB'}`, background: activeFolder === 'all' ? '#EEF2FF' : 'white', color: activeFolder === 'all' ? '#4F46E5' : '#6B7280', fontSize: '12.5px', fontWeight: activeFolder === 'all' ? 600 : 400, cursor: 'pointer' }}>
                    전체 <span style={{ color: '#9CA3AF', fontWeight: 400 }}>{tutorials.length}</span>
                  </button>
                  {/* 미분류 */}
                  <button onClick={() => setActiveFolder(null)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '999px', border: `1.5px solid ${activeFolder === null ? '#4F46E5' : '#E5E7EB'}`, background: activeFolder === null ? '#EEF2FF' : 'white', color: activeFolder === null ? '#4F46E5' : '#6B7280', fontSize: '12.5px', fontWeight: activeFolder === null ? 600 : 400, cursor: 'pointer' }}>
                    미분류 <span style={{ color: '#9CA3AF', fontWeight: 400 }}>{tutorials.filter(t => !t.folder_id).length}</span>
                  </button>
                  {/* 폴더들 */}
                  {folders.map(f => (
                    <div key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      {editingFolderId === f.id ? (
                        <input autoFocus value={editingFolderName} onChange={e => setEditingFolderName(e.target.value)}
                          onBlur={() => handleRenameFolder(f.id)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(f.id); if (e.key === 'Escape') setEditingFolderId(null); }}
                          style={{ padding: '4px 8px', borderRadius: '999px', border: '1.5px solid #4F46E5', fontSize: '12.5px', outline: 'none', width: '100px', fontFamily: 'inherit' }}
                          onClick={e => e.stopPropagation()} />
                      ) : (
                        <button onClick={() => setActiveFolder(f.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '999px', border: `1.5px solid ${activeFolder === f.id ? f.color : '#E5E7EB'}`, background: activeFolder === f.id ? `${f.color}15` : 'white', color: activeFolder === f.id ? f.color : '#6B7280', fontSize: '12.5px', fontWeight: activeFolder === f.id ? 600 : 400, cursor: 'pointer' }}
                          onDoubleClick={e => { e.stopPropagation(); setEditingFolderId(f.id); setEditingFolderName(f.name); }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: f.color, flexShrink: 0 }} />
                          {f.name}
                          <span style={{ color: '#9CA3AF', fontWeight: 400 }}>{tutorials.filter(t => t.folder_id === f.id).length}</span>
                        </button>
                      )}
                      <button onClick={() => handleDeleteFolder(f.id)}
                        style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#D1D5DB', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, opacity: 0, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0'; (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB'; }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                  {/* 새 폴더 */}
                  {showNewFolderInput ? (
                    <form onSubmit={handleCreateFolder} style={{ display: 'inline-flex', gap: '4px' }}>
                      <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="폴더 이름"
                        onKeyDown={e => { if (e.key === 'Escape') setShowNewFolderInput(false); }}
                        style={{ padding: '4px 10px', borderRadius: '999px', border: '1.5px solid #C7D2FE', fontSize: '12.5px', outline: 'none', width: '110px', fontFamily: 'inherit' }} />
                      <button type="submit" disabled={creatingFolder || !newFolderName.trim()}
                        style={{ padding: '4px 10px', borderRadius: '999px', background: '#4F46E5', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        {creatingFolder ? '...' : '추가'}
                      </button>
                    </form>
                  ) : (
                    <button onClick={() => { setShowNewFolderInput(true); setNewFolderName(''); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '999px', border: '1.5px dashed #D1D5DB', background: 'transparent', color: '#9CA3AF', fontSize: '12px', cursor: 'pointer' }}>
                      {/* 폴더 색상 선택 UI — 기본색 자동 배정 */}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      새 폴더
                    </button>
                  )}
                </div>
              )}

              {/* 매뉴얼 그리드 (3열) */}
              {tutLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{ borderRadius: '12px', background: 'white', border: '1px solid #E5E7EB', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ height: '13px', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                        <div style={{ height: '11px', width: '50%', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedTutorials.length === 0 ? (
                <EmptyState onRecord={() => setShowRecordingModal(true)} onBlank={handleCreateBlank} label={activeTab === 'team' ? '팀 매뉴얼이 없어요' : activeFolder !== 'all' ? '이 폴더에 매뉴얼이 없어요' : undefined} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {displayedTutorials.map(t => (
                    <TutorialCard key={t.id} tutorial={t} onDelete={handleRemove} onTitleChange={handleTitleChange} onMoveToFolder={handleMoveToFolder} folders={folders} />
                  ))}
                </div>
              )}

              {/* 폴더 색상 팔레트 (새 폴더 색상 선택용 hidden — 현재 자동 배정) */}
              <div style={{ display: 'none' }}>
                {FOLDER_COLORS.map(c => <span key={c} style={{ background: c }} />)}
              </div>
            </div>
          </main>
        </div>
      </div>

      <style>{`
        @keyframes recPulse { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:1; transform:scale(1.2); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
