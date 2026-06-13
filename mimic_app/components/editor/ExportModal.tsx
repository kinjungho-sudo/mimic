'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, UserPlus, Trash2, Send, Mail } from 'lucide-react';

interface ShareUser { name: string | null; avatar_url: string | null; }
interface ShareItem {
  id: string;
  email: string;
  role: 'viewer' | 'editor';
  user_id: string | null;
  created_at: string;
  user: ShareUser | null;
}

interface ExportModalProps {
  tutorialId: string;
  title: string;
  onClose: () => void;
}

export function ExportModal({ tutorialId, title, onClose }: ExportModalProps) {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tutorials/${tutorialId}/shares`);
      if (res.ok) { const { shares } = await res.json(); setShares(shares ?? []); }
    } finally { setLoading(false); }
  }, [tutorialId]);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    const e = email.trim();
    if (!e || inviting) return;
    setInviting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tutorials/${tutorialId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? '초대에 실패했습니다.'); return; }
      setShares(prev => {
        const others = prev.filter(s => s.email.toLowerCase() !== e.toLowerCase());
        return [...others, data.share];
      });
      setSentTo(e);
      setEmail('');
      setTimeout(() => setSentTo(null), 2800);
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (share: ShareItem, newRole: 'viewer' | 'editor') => {
    const res = await fetch(`/api/tutorials/${tutorialId}/shares/${share.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) setShares(prev => prev.map(s => s.id === share.id ? { ...s, role: newRole } : s));
  };

  const revoke = async (share: ShareItem) => {
    const res = await fetch(`/api/tutorials/${tutorialId}/shares/${share.id}`, { method: 'DELETE' });
    if (res.ok) setShares(prev => prev.filter(s => s.id !== share.id));
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.5)', zIndex: 50, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: '480px', background: 'white', borderRadius: '18px', boxShadow: '0 30px 80px rgba(0,0,0,0.22)', zIndex: 51, overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'linear-gradient(135deg,#e0e7ff,#F5F3FF)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <UserPlus size={18} color="#3730a3" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#111827' }}>내보내기 — 사람 초대</h2>
            <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#6B7280', lineHeight: 1.5 }}>
              <strong style={{ color: '#374151' }}>{title || '이 매뉴얼'}</strong>의 보기·편집 권한을 이메일로 부여합니다.
            </p>
          </div>
          <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280', display: 'grid', placeItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '18px 22px 22px' }}>
          {/* 초대 입력 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '0 10px' }}>
              <Mail size={14} color="#9CA3AF" />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') invite(); }}
                placeholder="초대할 이메일"
                type="email"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', padding: '10px 0', minWidth: 0 }}
              />
            </div>
            <select value={role} onChange={e => setRole(e.target.value as 'viewer' | 'editor')}
              style={{ border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '0 10px', fontSize: '12.5px', color: '#374151', cursor: 'pointer', outline: 'none' }}>
              <option value="viewer">보기</option>
              <option value="editor">편집</option>
            </select>
            <button onClick={invite} disabled={!email.trim() || inviting}
              style={{ padding: '0 14px', borderRadius: '10px', border: 'none', background: email.trim() && !inviting ? 'linear-gradient(135deg,#3730a3,#6d28d9)' : '#E5E7EB', color: 'white', fontSize: '12.5px', fontWeight: 600, cursor: email.trim() && !inviting ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Send size={13} /> 초대
            </button>
          </div>
          {error && <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#DC2626' }}>{error}</p>}
          {sentTo && <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#059669' }}>{sentTo} 님에게 초대를 보냈습니다.</p>}

          {/* 공유 목록 */}
          <div style={{ marginTop: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>접근 권한이 있는 사람</div>
            {loading ? (
              <div style={{ fontSize: '12.5px', color: '#9CA3AF', padding: '10px 0' }}>불러오는 중...</div>
            ) : shares.length === 0 ? (
              <div style={{ fontSize: '12.5px', color: '#9CA3AF', padding: '14px 0', textAlign: 'center' }}>아직 초대한 사람이 없습니다</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                {shares.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#EEF2FF', color: '#4338ca', display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                      {(s.user?.name || s.email).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user?.name || s.email}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.user_id ? s.email : `${s.email} · 가입 대기`}</div>
                    </div>
                    <select value={s.role} onChange={e => changeRole(s, e.target.value as 'viewer' | 'editor')}
                      style={{ border: '1px solid #E5E7EB', borderRadius: '7px', padding: '4px 6px', fontSize: '11.5px', color: '#374151', cursor: 'pointer', outline: 'none' }}>
                      <option value="viewer">보기</option>
                      <option value="editor">편집</option>
                    </select>
                    <button onClick={() => revoke(s)} title="공유 해제"
                      style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', display: 'grid', placeItems: 'center', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p style={{ margin: '16px 0 0', fontSize: '11px', color: '#9CA3AF', lineHeight: 1.5 }}>
            초대받은 사람은 MIMIC 계정(초대한 이메일)으로 로그인하면 접근할 수 있습니다. &lsquo;편집&rsquo;은 매뉴얼을 수정할 수 있고, &lsquo;보기&rsquo;는 열람만 가능합니다.
          </p>
        </div>
      </div>
    </>
  );
}
