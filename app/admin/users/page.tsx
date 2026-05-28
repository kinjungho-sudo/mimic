'use client';

import { useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'team';
  daily_manual_count: number;
  daily_limit: number;
  created_at: string;
}

const PLAN_COLORS: Record<string, string> = {
  free: '#64748B',
  pro: '#4F46E5',
  team: '#7C3AED',
};

const PLAN_BG: Record<string, string> = {
  free: '#F1F5F9',
  pro: '#EEF2FF',
  team: '#F5F3FF',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`${email} 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeleting(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        const d = await res.json();
        alert(`삭제 실패: ${d.error}`);
      }
    } finally {
      setDeleting(null);
    }
  }

  async function changePlan(userId: string, plan: string) {
    setUpdating(userId);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, plan }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: plan as User['plan'] } : u));
    setUpdating(null);
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px', color: '#0F172A' }}>유저 관리</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>총 {users.length}명</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', color: '#94A3B8', minWidth: '240px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이메일 또는 이름 검색..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontFamily: 'inherit', color: '#0F172A' }}
          />
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              {['이름', '이메일', '플랜', '오늘 사용', '가입일', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11.5px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>유저가 없습니다.</td></tr>
            ) : filtered.map((user, i) => (
              <tr key={user.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A' }}>{user.name || '-'}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>{user.email}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 500, background: PLAN_BG[user.plan], color: PLAN_COLORS[user.plan] }}>
                    {user.plan}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                  {user.daily_manual_count} / {user.daily_limit}
                </td>
                <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94A3B8' }}>
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={user.plan}
                    onChange={e => changePlan(user.id, e.target.value)}
                    disabled={updating === user.id}
                    style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px', color: '#475569', background: 'white', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="free">free</option>
                    <option value="pro">pro</option>
                    <option value="team">team</option>
                  </select>
                  <button
                    onClick={() => deleteUser(user.id, user.email)}
                    disabled={deleting === user.id}
                    style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #FCA5A5', fontSize: '12px', color: '#EF4444', background: '#FFF5F5', cursor: 'pointer', opacity: deleting === user.id ? 0.5 : 1 }}
                  >
                    {deleting === user.id ? '삭제 중...' : '삭제'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
