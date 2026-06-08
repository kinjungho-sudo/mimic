'use client';

import { useEffect, useState } from 'react';

interface ProSignup {
  id: string;
  email: string;
  plan_interested: 'pro' | 'team';
  source: 'landing' | 'editor' | 'limit_modal' | 'mypage';
  created_at: string;
  user_id: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  landing: '랜딩페이지',
  editor: '에디터',
  limit_modal: '한도 초과',
  mypage: '마이페이지',
};

export default function AdminProSignupsPage() {
  const [signups, setSignups] = useState<ProSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pro' | 'team'>('all');

  useEffect(() => {
    fetch('/api/admin/pro-signups')
      .then(r => r.json())
      .then(d => { setSignups(d.signups ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? signups : signups.filter(s => s.plan_interested === filter);

  const proCount = signups.filter(s => s.plan_interested === 'pro').length;
  const teamCount = signups.filter(s => s.plan_interested === 'team').length;

  const sourceBreakdown = signups.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ padding: '36px 40px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px', color: '#0F172A' }}>Pro 대기자 명단</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>총 {signups.length}명 대기 중</p>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: '전체', value: signups.length, color: '#0F172A', bg: 'white' },
          { label: 'Pro 플랜', value: proCount, color: '#3730a3', bg: '#e0e7ff' },
          { label: 'Team 플랜', value: teamCount, color: '#6d28d9', bg: '#F5F3FF' },
          { label: '가장 많은 유입', value: Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ? SOURCE_LABELS[Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1])[0][0]] : '-', color: '#0369A1', bg: '#F0F9FF' },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px 20px' }}>
            <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 유입 경로 분포 */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '14px' }}>유입 경로</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {Object.entries(sourceBreakdown).map(([source, count]) => (
            <div key={source} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '12px', color: '#475569' }}>{SOURCE_LABELS[source] ?? source}</div>
              <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#F1F5F9', fontSize: '12px', fontWeight: 500, color: '#0F172A' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 + 테이블 */}
      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '4px', padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
          {(['all', 'pro', 'team'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, border: 'none', cursor: 'pointer', background: filter === f ? '#0F172A' : 'transparent', color: filter === f ? 'white' : '#64748B', transition: 'background 0.15s' }}
            >
              {f === 'all' ? '전체' : f === 'pro' ? 'Pro' : 'Team'}
            </button>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['이메일', '플랜', '유입 경로', '유저 연결', '신청일'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11.5px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>대기자가 없습니다.</td></tr>
            ) : filtered.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={{ padding: '13px 16px', fontSize: '13px', color: '#0F172A' }}>{s.email}</td>
                <td style={{ padding: '13px 16px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 500, background: s.plan_interested === 'pro' ? '#e0e7ff' : '#F5F3FF', color: s.plan_interested === 'pro' ? '#3730a3' : '#6d28d9' }}>
                    {s.plan_interested}
                  </span>
                </td>
                <td style={{ padding: '13px 16px', fontSize: '12.5px', color: '#64748B' }}>
                  {SOURCE_LABELS[s.source] ?? s.source}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  {s.user_id ? (
                    <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11.5px', background: '#DCFCE7', color: '#16A34A' }}>연결됨</span>
                  ) : (
                    <span style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '11.5px', background: '#F1F5F9', color: '#94A3B8' }}>미연결</span>
                  )}
                </td>
                <td style={{ padding: '13px 16px', fontSize: '12px', color: '#94A3B8' }}>
                  {new Date(s.created_at).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
