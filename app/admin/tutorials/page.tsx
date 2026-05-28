'use client';

import { useEffect, useState } from 'react';

interface Tutorial {
  id: string;
  title: string;
  status: 'draft' | 'published';
  visibility: 'private' | 'public';
  mode: 'interactive' | 'guide';
  created_at: string;
  user_id: string;
  mm_users: { email: string; name: string } | null;
  view_count: number;
}

export default function AdminTutorialsPage() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/tutorials')
      .then(r => r.json())
      .then(d => { setTutorials(d.tutorials ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function deleteTutorial(tutorialId: string, title: string) {
    if (!confirm(`"${title}" 튜토리얼을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeleting(tutorialId);
    const res = await fetch('/api/admin/tutorials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorialId }),
    });
    if (res.ok) {
      setTutorials(prev => prev.filter(t => t.id !== tutorialId));
    }
    setDeleting(null);
  }

  const filtered = tutorials.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.mm_users?.email.toLowerCase().includes(search.toLowerCase()) ||
    t.mm_users?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px', color: '#0F172A' }}>튜토리얼 관리</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>총 {tutorials.length}개</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', color: '#94A3B8', minWidth: '240px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="제목 또는 작성자 검색..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontFamily: 'inherit', color: '#0F172A' }}
          />
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              {['제목', '작성자', '상태', '공개', '모드', '조회수', '생성일', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11.5px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>튜토리얼이 없습니다.</td></tr>
            ) : filtered.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <td style={{ padding: '14px 16px', maxWidth: '260px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title || '(제목 없음)'}
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569' }}>
                  <div>{t.mm_users?.name || '-'}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11.5px' }}>{t.mm_users?.email || '-'}</div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 500, background: t.status === 'published' ? '#DCFCE7' : '#F1F5F9', color: t.status === 'published' ? '#16A34A' : '#64748B' }}>
                    {t.status === 'published' ? '공개됨' : '초안'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 500, background: t.visibility === 'public' ? '#EEF2FF' : '#F1F5F9', color: t.visibility === 'public' ? '#4F46E5' : '#64748B' }}>
                    {t.visibility === 'public' ? '공개' : '비공개'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                  {t.mode === 'interactive' ? '인터랙티브' : '가이드'}
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 500, color: t.view_count > 0 ? '#0F172A' : '#CBD5E1' }}>
                  {t.view_count.toLocaleString()}
                </td>
                <td style={{ padding: '14px 16px', fontSize: '12px', color: '#94A3B8' }}>
                  {new Date(t.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <button
                    onClick={() => deleteTutorial(t.id, t.title)}
                    disabled={deleting === t.id}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #FEE2E2', fontSize: '12px', color: '#EF4444', background: '#FFF5F5', cursor: 'pointer', opacity: deleting === t.id ? 0.5 : 1 }}
                  >
                    삭제
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
