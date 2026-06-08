'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type TrashItem = {
  id: string;
  title: string;
  deleted_at: string;
  workspace_id: string | null;
  updated_at: string;
};

function daysAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}

// 삭제 30일 후 자동 영구삭제 — 남은 일수 계산
function daysLeft(deletedAt: string): number {
  const diff = 30 * 86400000 - (Date.now() - new Date(deletedAt).getTime());
  return Math.max(0, Math.ceil(diff / 86400000));
}

function PermanentDeleteModal({ title, onConfirm, onClose }: {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'grid', placeItems: 'center', background: 'rgba(10,10,15,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '380px', background: 'white', borderRadius: '16px', padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '16px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FEF2F2', display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>영구 삭제하시겠습니까?</h3>
        <p style={{ fontSize: '13.5px', color: '#6B7280', margin: '0 0 6px', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600, color: '#374151' }}>&quot;{title}&quot;</span>을 영구적으로 삭제합니다.
        </p>
        <p style={{ fontSize: '12.5px', color: '#EF4444', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 12px', margin: '10px 0 0' }}>
          이 작업은 되돌릴 수 없습니다.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button onClick={onClose}
            style={{ flex: 1, height: '40px', borderRadius: '9px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
            취소
          </button>
          <button onClick={() => { onConfirm(); onClose(); }}
            style={{ flex: 1, height: '40px', borderRadius: '9px', border: 'none', background: '#EF4444', color: 'white', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EF4444'; }}>
            영구 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrashPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permanentTarget, setPermanentTarget] = useState<TrashItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trash');
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  const handleRestore = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/trash/${id}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? '복원 실패');
        return;
      }
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/trash/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? '영구 삭제 실패');
        return;
      }
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA', fontFamily: "'Pretendard Variable', sans-serif", color: '#9CA3AF', fontSize: '14px' }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: "'Pretendard Variable', -apple-system, sans-serif", fontSize: '13.5px', color: '#111827' }}>
      {permanentTarget && (
        <PermanentDeleteModal
          title={permanentTarget.title}
          onConfirm={() => handlePermanentDelete(permanentTarget.id)}
          onClose={() => setPermanentTarget(null)}
        />
      )}

      {/* 헤더 */}
      <header style={{ background: 'white', borderBottom: '1px solid #F3F4F6', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 30 }}>
        <button
          onClick={() => router.push('/home')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '4px 0' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#374151'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          홈
        </button>
        <span style={{ color: '#D1D5DB' }}>/</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          <span style={{ fontWeight: 600, color: '#111827' }}>휴지통</span>
        </div>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '36px 24px' }}>
        {/* 안내 배너 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', marginBottom: '24px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '1px' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: '13px', color: '#92400E', margin: 0, lineHeight: 1.5 }}>
            휴지통의 매뉴얼은 <strong>30일 후 자동으로 영구 삭제</strong>됩니다. 복원이 필요하면 기한 내에 복원해주세요.
          </p>
        </div>

        {/* 목록 */}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#F3F4F6', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: '#D1D5DB' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>휴지통이 비어 있어요</div>
            <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '20px' }}>삭제한 매뉴얼이 여기에 표시됩니다.</div>
            <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#3730a3', color: 'white', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
              홈으로 돌아가기
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map(item => {
              const remaining = daysLeft(item.deleted_at);
              const isUrgent = remaining <= 7;
              const isLoading = actionLoading === item.id;
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'white', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                  {/* 아이콘 */}
                  <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#F3F4F6', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#9CA3AF' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>

                  {/* 텍스트 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      {item.workspace_id && (
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#3730a3', background: '#e0e7ff', padding: '1px 6px', borderRadius: '999px', flexShrink: 0 }}>팀</span>
                      )}
                      <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>{daysAgo(item.deleted_at)} 삭제됨</span>
                      <span style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#D1D5DB', flexShrink: 0 }} />
                      <span style={{ fontSize: '11.5px', color: isUrgent ? '#EF4444' : '#9CA3AF', fontWeight: isUrgent ? 600 : 400 }}>
                        {remaining > 0 ? `${remaining}일 후 자동 삭제` : '곧 삭제됨'}
                      </span>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleRestore(item.id)}
                      disabled={isLoading}
                      title="복원"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '32px', padding: '0 12px', borderRadius: '7px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: '12.5px', fontWeight: 500, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
                      onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#3730a3'; e.currentTarget.style.color = '#3730a3'; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
                      복원
                    </button>
                    <button
                      onClick={() => setPermanentTarget(item)}
                      disabled={isLoading}
                      title="영구 삭제"
                      style={{ width: '32px', height: '32px', borderRadius: '7px', border: '1px solid #E5E7EB', background: 'white', color: '#D1D5DB', display: 'grid', placeItems: 'center', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
                      onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#EF4444'; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#D1D5DB'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
