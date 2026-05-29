'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTutorials } from '@/hooks/useTutorials';
import { RecordingModal } from '@/components/dashboard/RecordingModal';
import { createTutorial } from '@/lib/api/tutorials';
import type { Tutorial } from '@/types';

// ── 유틸 ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '안녕하세요';
  return '안녕하세요';
}

// 매뉴얼 카드 썸네일 그라데이션 — 스크린샷 없을 때 폴백
const THUMB_GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#f093fb', '#f5576c'],
];
function thumbColors(id: string) {
  const n = id.charCodeAt(0) % THUMB_GRADIENTS.length;
  return THUMB_GRADIENTS[n];
}

// ── 컴포넌트 ──────────────────────────────────────────────

function UpgradeBanner({ used, limit }: { used: number; limit: number }) {
  const remaining = limit - used;
  if (remaining > limit * 0.5) return null; // 50% 이상 남으면 안 보여줌
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
      padding: '10px 20px', background: 'linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%)',
      fontSize: '13px', color: 'white',
    }}>
      <span>
        {remaining <= 0
          ? '무료 플랜 한도를 모두 사용했어요.'
          : `무료 플랜에서 매뉴얼을 ${remaining}개 더 만들 수 있어요.`}
      </span>
      <Link href="/mypage" style={{
        padding: '4px 12px', borderRadius: '999px', background: 'white',
        color: '#4F46E5', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
        flexShrink: 0,
      }}>
        Pro로 업그레이드
      </Link>
    </div>
  );
}

function TutorialCard({ tutorial, onDelete, onTitleChange, author }: {
  tutorial: Tutorial;
  onDelete: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  author: { name: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(tutorial.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const fallbackColor = thumbColors(tutorial.id)[0];
  const coverColor = tutorial.cover_color
    ? tutorial.cover_color.split(',')[0].trim()
    : fallbackColor;

  const stepCount = tutorial.step_count ?? 0;
  const dateStr = new Date(tutorial.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');

  const showAvatar = !!author.avatarUrl && !avatarError;
  const authorInitial = author.name.charAt(0).toUpperCase() || '?';

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
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  }, [titleDraft, tutorial.id, tutorial.title, onTitleChange]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!editingTitle) router.push(`/manual/${tutorial.id}/editor`); }}
      style={{
        background: 'white',
        borderRadius: '14px',
        cursor: 'pointer',
        border: '1px solid #E5E7EB',
        boxShadow: hovered ? '0 6px 20px rgba(17,24,39,0.10)' : '0 1px 3px rgba(17,24,39,0.06)',
        transition: 'box-shadow 0.18s, transform 0.18s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── 썸네일 영역 (16:9) ── */}
      <div style={{ position: 'relative', paddingTop: '56.25%', flexShrink: 0 }}>
        {tutorial.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tutorial.thumbnail_url}
            alt={tutorial.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          /* 썸네일 없을 때: cover_color 배경 + 제목 중앙 정렬 */
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(135deg, ${coverColor}ee 0%, ${coverColor}99 100%)`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '20px 18px', gap: '10px',
          }}>
            {/* 배경 장식 원 */}
            <div style={{ position: 'absolute', right: '-18px', bottom: '-18px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: '-10px', top: '-10px', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
            {/* 문서 아이콘 */}
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            {/* 제목 */}
            <div style={{
              fontSize: '14px', fontWeight: 700, color: 'white', lineHeight: 1.45,
              textAlign: 'center',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
              textShadow: '0 1px 4px rgba(0,0,0,0.2)',
              zIndex: 1,
            }}>
              {tutorial.title}
            </div>
          </div>
        )}

        {/* 상태 뱃지 — 좌상단 */}
        {tutorial.status === 'published' && (
          <span style={{
            position: 'absolute', top: '10px', left: '10px', zIndex: 2,
            padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600,
            background: 'rgba(22,163,74,0.9)', color: 'white', backdropFilter: 'blur(4px)',
          }}>
            공유
          </span>
        )}

        {/* 단계 수 뱃지 — 우하단 */}
        {stepCount > 0 && (
          <span style={{
            position: 'absolute', bottom: '10px', right: '10px', zIndex: 2,
            padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 500,
            background: 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(4px)',
          }}>
            {stepCount} 단계
          </span>
        )}

        {/* 삭제 버튼 — 호버 시 우상단 */}
        <button
          onClick={e => { e.stopPropagation(); if (confirm('이 매뉴얼을 삭제할까요?')) onDelete(tutorial.id); }}
          style={{
            position: 'absolute', top: '8px', right: '8px', zIndex: 3,
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.45)', border: 'none', color: 'white',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>

      {/* ── 하단 정보 영역 ── */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {/* 제목 */}
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(tutorial.title); } }}
            onClick={e => e.stopPropagation()}
            disabled={savingTitle}
            style={{
              fontSize: '13.5px', fontWeight: 600, color: '#111827', lineHeight: 1.45,
              border: '1.5px solid #4F46E5', borderRadius: '6px',
              padding: '4px 8px', outline: 'none', width: '100%', boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            onClick={e => { e.stopPropagation(); setEditingTitle(true); }}
            title="클릭해서 제목 편집"
            style={{
              fontSize: '13.5px', fontWeight: 600, color: '#111827', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden', cursor: 'text',
            }}
          >
            {tutorial.title}
          </div>
        )}

        {/* 날짜 */}
        <div style={{ fontSize: '11.5px', color: '#9CA3AF' }}>{dateStr}</div>

        {/* 구분선 + 작성자 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px', borderTop: '1px solid #F3F4F6' }}>
          {showAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatarUrl!}
              alt={author.name}
              onError={() => setAvatarError(true)}
              style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
              background: coverColor, display: 'grid', placeItems: 'center',
              fontSize: '9px', fontWeight: 700, color: 'white',
            }}>
              {authorInitial}
            </div>
          )}
          <span style={{ fontSize: '11.5px', color: '#6B7280', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {author.name}
          </span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onRecord, onBlank }: { onRecord: () => void; onBlank: () => void }) {
  return (
    <div style={{ gridColumn: '1 / -1', padding: '72px 24px', textAlign: 'center' }}>
      <div style={{ margin: '0 auto 18px', width: '80px', height: '80px', borderRadius: '20px', background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', display: 'grid', placeItems: 'center', color: '#4F46E5' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      </div>
      <div style={{ fontSize: '17px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>아직 만든 매뉴얼이 없어요</div>
      <div style={{ fontSize: '13.5px', color: '#6B7280', marginBottom: '28px', lineHeight: 1.6 }}>
        화면을 녹화하거나 직접 편집해서 매뉴얼을 만들어보세요.
      </div>
      <div style={{ display: 'inline-flex', gap: '10px' }}>
        <button
          onClick={onRecord}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 22px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(79,70,229,0.30)' }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: 'recPulse 1.4s ease-in-out infinite' }} />
          화면 녹화로 만들기
        </button>
        <button
          onClick={onBlank}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 22px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#4F46E5', border: '1.5px solid #C7D2FE', cursor: 'pointer' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          직접 편집하기
        </button>
      </div>
    </div>
  );
}


// ── 페이지 ────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { tutorials, loading: tutLoading, remove, updateTitle, refresh } = useTutorials(!!user);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const allManualsRef = useRef<HTMLElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  // 다른 탭(녹화 탭)에서 돌아왔을 때 자동 새로고침
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [refresh]);

  const usedToday = user?.daily_manual_count ?? 0;
  const dailyLimit = user?.daily_limit ?? 3;
  const firstName = user?.name?.split(' ')[0] ?? '';

  const handleNewManual = () => setShowRecordingModal(true);
  const handleSignOut = async () => { await signOut(); router.push('/auth/login'); };

  const handleCreateBlank = async () => {
    setShowNewMenu(false);
    setCreating(true);
    try {
      const tutorial = await createTutorial();
      router.push(`/manual/${tutorial.id}/editor`);
    } catch {
      alert('생성 중 오류가 발생했습니다.');
      setCreating(false);
    }
  };

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!showNewMenu) return;
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewMenu]);

  const recentTutorials = [...tutorials].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ).slice(0, 3);

  return (
    <>
      {showRecordingModal && <RecordingModal onClose={() => setShowRecordingModal(false)} />}

      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        fontFamily: "'Pretendard', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: '13.5px', color: '#111827', background: '#F8F9FA',
      }}>

        {/* ── 업그레이드 배너 ── */}
        {!authLoading && <UpgradeBanner used={usedToday} limit={dailyLimit} />}

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1 }}>

          {/* ── 사이드바 ── */}
          <aside style={{
            background: 'white', borderRight: '1px solid #F3F4F6',
            padding: '16px 12px', display: 'flex', flexDirection: 'column',
            position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
          }}>
            {/* 로고 */}
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 16px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', color: '#111827', letterSpacing: '-0.02em' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <rect x="3.2" y="5.2" width="11" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/>
                  <rect x="3.2" y="10.8" width="14" height="2.4" rx="1.2" fill="white"/>
                  <rect x="3.2" y="16.4" width="8" height="2.4" rx="1.2" fill="white" fillOpacity="0.5"/>
                  <circle cx="18.7" cy="17.6" r="3.6" fill="white"/>
                  <path d="M17.6 16.1 L20.1 17.6 L17.6 19.1 Z" fill="#4F46E5"/>
                </svg>
              </span>
              MIMIC
            </Link>

            {/* 네비게이션 */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { label: '홈', href: '/dashboard', active: true, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                { label: '내 매뉴얼', href: '/dashboard', active: false, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
                { label: '마이페이지', href: '/mypage', active: false, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                { label: '설정', href: '/settings', active: false, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
              ].map(item => (
                <Link key={item.label} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px',
                  fontSize: '13.5px', textDecoration: 'none',
                  color: item.active ? '#4F46E5' : '#4B5563',
                  background: item.active ? '#EEF2FF' : 'transparent',
                  fontWeight: item.active ? 600 : 400,
                }}>
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* 하단 유저 영역 */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <Link href="/mypage" style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', textDecoration: 'none', color: '#374151' }}>
                {user?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.name} style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                    {authLoading ? '·' : firstName.charAt(0) || '?'}
                  </div>
                )}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authLoading ? '...' : (user?.name ?? '내 계정')}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.plan === 'free' ? '무료 플랜' : 'Pro'}</div>
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
            <header style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              height: '60px', padding: '0 32px',
              background: 'white', borderBottom: '1px solid #F3F4F6',
              position: 'sticky', top: 0, zIndex: 30,
            }}>
              {/* 검색 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '380px', height: '36px', padding: '0 12px', border: '1px solid #E5E7EB', borderRadius: '9px', background: '#F9FAFB', color: '#9CA3AF' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input placeholder="매뉴얼 검색..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontFamily: 'inherit', color: '#374151' }} />
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* 사용량 뱃지 */}
                {!authLoading && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '999px', background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: '12px', color: '#4B5563' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: usedToday >= dailyLimit ? '#EF4444' : '#10B981', flexShrink: 0 }} />
                    오늘 {usedToday}/{dailyLimit}
                  </span>
                )}
                {/* 새 매뉴얼 드롭다운 */}
                <div ref={newMenuRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowNewMenu(v => !v)}
                    disabled={creating}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '9px', background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: 'white', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', fontSize: '13.5px', fontWeight: 600, boxShadow: '0 2px 8px rgba(79,70,229,0.28)', whiteSpace: 'nowrap', opacity: creating ? 0.7 : 1 }}
                  >
                    {creating ? (
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.85)', animation: 'recPulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
                    )}
                    새 매뉴얼
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: '2px', transform: showNewMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  {showNewMenu && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '220px', background: 'white', borderRadius: '12px', boxShadow: '0 8px 28px rgba(17,24,39,0.14), 0 0 0 1px rgba(0,0,0,0.06)', overflow: 'hidden', zIndex: 100 }}>
                      <button
                        onClick={() => { setShowNewMenu(false); handleNewManual(); }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEE2E2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="#EF4444"/></svg>
                        </span>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>화면 녹화로 만들기</div>
                          <div style={{ fontSize: '11.5px', color: '#6B7280', lineHeight: 1.4 }}>클릭 동작을 자동으로 캡처해요</div>
                        </div>
                      </button>

                      <div style={{ height: '1px', background: '#F3F4F6', margin: '0 12px' }} />

                      <button
                        onClick={handleCreateBlank}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        </span>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>직접 편집하기</div>
                          <div style={{ fontSize: '11.5px', color: '#6B7280', lineHeight: 1.4 }}>이미지를 업로드해 매뉴얼을 만들어요</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* 페이지 본문 */}
            <div style={{ padding: '36px 40px', flex: 1 }}>

              {/* 인사말 */}
              <div style={{ marginBottom: '36px' }}>
                <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 6px', color: '#0F172A' }}>
                  {authLoading ? '' : `${greeting()}, ${firstName}님`} 👋
                </h1>
                <p style={{ fontSize: '14.5px', color: '#6B7280', margin: 0 }}>
                  오늘도 멋진 매뉴얼을 만들어볼까요?
                </p>
              </div>

              {/* 최근 매뉴얼 — 있을 때만 */}
              {!tutLoading && recentTutorials.length > 0 && (
                <section style={{ marginBottom: '44px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>최근 작업</h2>
                    <button onClick={() => allManualsRef.current?.scrollIntoView({ behavior: 'smooth' })} style={{ fontSize: '12.5px', color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>전체 보기</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                    {recentTutorials.map(t => <TutorialCard key={t.id} tutorial={t} onDelete={remove} onTitleChange={updateTitle} author={{ name: user?.name ?? '나', avatarUrl: user?.avatar_url ?? null }} />)}
                  </div>
                </section>
              )}

              {/* 전체 매뉴얼 */}
              <section ref={allManualsRef}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                    내 매뉴얼
                    {!tutLoading && <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 400, color: '#9CA3AF' }}>{tutorials.length}개</span>}
                  </h2>
                </div>

                {tutLoading ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ borderRadius: '14px', background: 'white', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                        <div style={{ paddingTop: '56.25%', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ height: '13px', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                          <div style={{ height: '13px', width: '65%', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                          <div style={{ height: '11px', width: '40%', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                          <div style={{ height: '1px', background: '#F3F4F6' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', flexShrink: 0 }} />
                            <div style={{ height: '11px', width: '60px', borderRadius: '6px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : tutorials.length === 0 ? (
                  <EmptyState onRecord={handleNewManual} onBlank={handleCreateBlank} />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                    {tutorials.map(t => <TutorialCard key={t.id} tutorial={t} onDelete={remove} onTitleChange={updateTitle} author={{ name: user?.name ?? '나', avatarUrl: user?.avatar_url ?? null }} />)}
                  </div>
                )}
              </section>
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
