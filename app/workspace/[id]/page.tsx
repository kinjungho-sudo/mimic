'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { WorkspaceMember, WorkspaceInvitation, WorkspaceRole } from '@/types';

type WorkspaceDetail = {
  id: string;
  name: string;
  owner_id: string;
  my_role: WorkspaceRole;
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
};

const ROLE_LABEL: Record<WorkspaceRole, string> = { admin: '관리자', editor: '편집자', viewer: '뷰어' };
const ROLE_COLOR: Record<WorkspaceRole, string> = { admin: '#3730a3', editor: '#10B981', viewer: '#6B7280' };
const ROLE_BG: Record<WorkspaceRole, string> = { admin: '#e0e7ff', editor: '#D1FAE5', viewer: '#F3F4F6' };

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [ws, setWs] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 초대 폼
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 워크스페이스 이름 변경
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // 워크스페이스 삭제
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${id}`);
      if (!res.ok) { setError('워크스페이스를 찾을 수 없습니다.'); return; }
      setWs(await res.json());
    } catch { setError('불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const isAdmin  = ws?.my_role === 'admin';
  const isOwner  = ws ? ws.owner_id === user?.id : false;

  const handleRenameSave = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === ws?.name) { setEditingName(false); return; }
    setNameSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) { await load(); setEditingName(false); }
    } finally { setNameSaving(false); }
  };

  const handleDeleteWorkspace = async () => {
    if (!confirm(`"${ws?.name}" 워크스페이스를 삭제할까요?\n\n포함된 팀 매뉴얼은 개인 매뉴얼로 이동합니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/home');
    } finally { setDeleting(false); }
  };

  const handleResendInvite = async (email: string, role: WorkspaceRole, token: string) => {
    // 기존 초대 취소 후 재발송
    await fetch(`/api/workspaces/${id}/invitations?token=${token}`, { method: 'DELETE' });
    const res = await fetch(`/api/workspaces/${id}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    if (res.ok) { setInviteMsg({ ok: true, text: `${email}에 재발송했습니다.` }); load(); }
    else setInviteMsg({ ok: false, text: '재발송 실패' });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`/api/workspaces/${id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteMsg({ ok: false, text: data.error ?? '초대 실패' }); return; }
      setInviteMsg({ ok: true, text: `${inviteEmail}에 초대장을 발송했습니다.` });
      setInviteEmail('');
      load();
    } catch { setInviteMsg({ ok: false, text: '오류가 발생했습니다.' }); }
    finally { setInviting(false); }
  };

  const handleRoleChange = async (memberId: string, role: WorkspaceRole) => {
    await fetch(`/api/workspaces/${id}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    load();
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`${memberName}님을 워크스페이스에서 제거할까요?`)) return;
    await fetch(`/api/workspaces/${id}/members/${memberId}`, { method: 'DELETE' });
    load();
  };

  const handleCancelInvite = async (token: string) => {
    await fetch(`/api/workspaces/${id}/invitations?token=${token}`, { method: 'DELETE' });
    load();
  };

  if (loading || authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA', fontFamily: "'Pretendard Variable', sans-serif", color: '#9CA3AF', fontSize: '14px' }}>
        로딩 중...
      </div>
    );
  }

  if (error || !ws) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA', fontFamily: "'Pretendard Variable', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>{error ?? '접근 권한이 없습니다.'}</div>
          <Link href="/home" style={{ fontSize: '14px', color: '#3730a3', textDecoration: 'none' }}>홈으로</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F9FA', padding: '0',
      fontFamily: "'Pretendard Variable', -apple-system, sans-serif", fontSize: '13.5px', color: '#111827',
    }}>
      {/* 헤더 */}
      <header style={{ background: 'white', borderBottom: '1px solid #F3F4F6', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 30 }}>
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9CA3AF', textDecoration: 'none', fontSize: '13px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          홈
        </Link>
        <span style={{ color: '#D1D5DB' }}>/</span>
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={handleRenameSave}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') setEditingName(false); }}
            style={{ fontWeight: 600, fontSize: '13.5px', border: '1px solid #a5b4fc', borderRadius: '6px', padding: '2px 8px', outline: 'none', minWidth: '120px' }}
          />
        ) : (
          <span
            style={{ fontWeight: 600, color: '#111827', cursor: isAdmin ? 'text' : 'default' }}
            title={isAdmin ? '클릭하여 이름 변경' : undefined}
            onClick={() => { if (isAdmin) { setNameInput(ws.name); setEditingName(true); } }}
          >
            {nameSaving ? '저장 중…' : ws.name}
          </span>
        )}
        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: ROLE_BG[ws.my_role], color: ROLE_COLOR[ws.my_role], marginLeft: '4px' }}>
          {ROLE_LABEL[ws.my_role]}
        </span>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '36px 24px' }}>

        {/* 초대 폼 (admin만) */}
        {isAdmin && (
          <section style={{ background: 'white', borderRadius: '14px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px', color: '#111827' }}>팀원 초대</h2>
            <form onSubmit={handleInvite} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="이메일 주소 입력"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                style={{
                  flex: '1 1 220px', padding: '9px 14px', borderRadius: '9px', border: '1px solid #E5E7EB',
                  fontSize: '13.5px', outline: 'none', fontFamily: 'inherit',
                }}
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                style={{
                  padding: '9px 12px', borderRadius: '9px', border: '1px solid #E5E7EB',
                  fontSize: '13.5px', background: 'white', color: '#374151', fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <option value="viewer">뷰어</option>
                <option value="editor">편집자</option>
                <option value="admin">관리자</option>
              </select>
              <button
                type="submit"
                disabled={inviting}
                style={{
                  padding: '9px 18px', borderRadius: '9px', background: 'linear-gradient(135deg, #3730a3, #6d28d9)',
                  color: 'white', border: 'none', cursor: inviting ? 'not-allowed' : 'pointer',
                  fontSize: '13.5px', fontWeight: 600, opacity: inviting ? 0.7 : 1, flexShrink: 0,
                }}
              >
                {inviting ? '발송 중...' : '초대장 발송'}
              </button>
            </form>
            {inviteMsg && (
              <p style={{ margin: '10px 0 0', fontSize: '13px', color: inviteMsg.ok ? '#10B981' : '#EF4444' }}>{inviteMsg.text}</p>
            )}
          </section>
        )}

        {/* 멤버 목록 */}
        <section style={{ background: 'white', borderRadius: '14px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px', color: '#111827' }}>
            멤버
            <span style={{ marginLeft: '6px', fontWeight: 400, fontSize: '13px', color: '#9CA3AF' }}>{ws.members.length}명</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {ws.members.map(m => {
              const isMe = m.user_id === user?.id;
              const isOwner = m.user_id === ws.owner_id;
              const initial = (m.user?.name ?? '?').charAt(0).toUpperCase();
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: isMe ? '#F9FAFB' : 'transparent' }}>
                  {m.user?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.user.avatar_url} alt={m.user.name} style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #3730a3, #6d28d9)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>{initial}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.user?.name ?? '알 수 없음'} {isMe && <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>(나)</span>}
                      {isOwner && <span style={{ marginLeft: '6px', fontSize: '10.5px', color: '#F59E0B', fontWeight: 600 }}>소유자</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user?.email}</div>
                  </div>
                  {/* 권한 변경 (admin이고, 소유자 아닌 경우) */}
                  {isAdmin && !isOwner ? (
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value as WorkspaceRole)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        padding: '4px 8px', borderRadius: '7px', border: '1px solid #E5E7EB',
                        fontSize: '12px', background: 'white', color: ROLE_COLOR[m.role], fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      <option value="viewer">뷰어</option>
                      <option value="editor">편집자</option>
                      <option value="admin">관리자</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: ROLE_BG[m.role], color: ROLE_COLOR[m.role], flexShrink: 0 }}>
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                  {/* 제거 버튼 (admin이고, 소유자 아닌 경우 or 본인 탈퇴) */}
                  {(isAdmin && !isOwner) || (isMe && !isOwner) ? (
                    <button
                      onClick={() => handleRemoveMember(m.id, m.user?.name ?? '멤버')}
                      style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'transparent', color: '#D1D5DB', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB'; }}
                      title={isMe ? '탈퇴' : '제거'}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* 대기 중인 초대 */}
        {isAdmin && ws.invitations.length > 0 && (
          <section style={{ background: 'white', borderRadius: '14px', border: '1px solid #E5E7EB', padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px', color: '#111827' }}>
              초대 대기 중
              <span style={{ marginLeft: '6px', fontWeight: 400, fontSize: '13px', color: '#9CA3AF' }}>{ws.invitations.length}건</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {ws.invitations.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#F3F4F6', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                      만료: {new Date(inv.expires_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: ROLE_BG[inv.role], color: ROLE_COLOR[inv.role], flexShrink: 0 }}>
                    {ROLE_LABEL[inv.role]}
                  </span>
                  {/* 재발송 버튼 */}
                  <button
                    onClick={() => handleResendInvite(inv.email, inv.role, inv.token)}
                    style={{ height: '28px', padding: '0 10px', borderRadius: '7px', border: '1px solid #E5E7EB', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '11.5px', fontWeight: 500, flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3730a3'; (e.currentTarget as HTMLButtonElement).style.color = '#3730a3'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; }}
                    title="재발송"
                  >
                    재발송
                  </button>
                  {/* 취소 버튼 */}
                  <button
                    onClick={() => handleCancelInvite(inv.token)}
                    style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: 'transparent', color: '#D1D5DB', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB'; }}
                    title="초대 취소"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 하단 액션 */}
        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <button
            onClick={() => router.push('/home')}
            style={{ padding: '9px 20px', borderRadius: '9px', background: 'white', border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer', fontSize: '13.5px', fontWeight: 500 }}
          >
            ← 홈으로
          </button>

          {/* 워크스페이스 삭제 — owner만 */}
          {isOwner && (
            <button
              onClick={handleDeleteWorkspace}
              disabled={deleting}
              style={{ padding: '9px 20px', borderRadius: '9px', background: deleting ? '#F9FAFB' : 'white', border: '1px solid #FCA5A5', color: '#EF4444', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: '13.5px', fontWeight: 600, opacity: deleting ? 0.6 : 1 }}
              onMouseEnter={e => { if (!deleting) { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; } }}
              onMouseLeave={e => { if (!deleting) { (e.currentTarget as HTMLButtonElement).style.background = 'white'; } }}
            >
              {deleting ? '삭제 중…' : '워크스페이스 삭제'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
